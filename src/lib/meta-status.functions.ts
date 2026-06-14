import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REQUIRED_SCOPES = [
  "ads_management",
  "ads_read",
  "leads_retrieval",
  "pages_manage_ads",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_show_list",
];

export type PageStatus = {
  page_id: string;
  page_name: string;
  subscribed_to_leadgen: boolean;
  subscribed_apps_error: string | null;
  can_resubscribe: boolean;
  resubscribe_error: string | null;
  leadgen_forms_count: number;
  leadgen_total_leads: number;
  missing_page_scopes: string[];
};

export type MetaStatus = {
  connected: boolean;
  user_id: string | null;
  user_name: string | null;
  granted_scopes: string[];
  missing_scopes: string[];
  declined_scopes: string[];
  pages: PageStatus[];
  webhook_callback_url: string;
  reconnect_url: string;
};

export const getMetaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaStatus> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { metaApiVersion } = await import("@/lib/meta.server");
    const v = metaApiVersion();

    const reconnect_url = `/api/meta/auth/start?uid=${userId}`;
    const webhook_callback_url = "https://adpilot.ro/api/public/meta/webhook";

    const { data: conn } = await supabaseAdmin
      .from("meta_connections")
      .select("access_token, meta_user_id, meta_user_name")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!conn?.access_token) {
      return {
        connected: false,
        user_id: null,
        user_name: null,
        granted_scopes: [],
        missing_scopes: REQUIRED_SCOPES,
        declined_scopes: [],
        pages: [],
        webhook_callback_url,
        reconnect_url,
      };
    }

    // Permissions on the user token
    const granted: string[] = [];
    const declined: string[] = [];
    try {
      const r = await fetch(
        `https://graph.facebook.com/${v}/me/permissions?access_token=${encodeURIComponent(conn.access_token)}`,
      );
      const j = await r.json();
      for (const p of j?.data ?? []) {
        if (p.status === "granted") granted.push(p.permission);
        else if (p.status === "declined") declined.push(p.permission);
      }
    } catch {
      /* ignore */
    }
    const missing_scopes = REQUIRED_SCOPES.filter((s) => !granted.includes(s));

    // Pages
    const { data: pages } = await supabaseAdmin
      .from("meta_pages")
      .select("page_id, page_name, page_access_token")
      .eq("user_id", userId)
      .eq("is_active", true);

    const META_APP_ID = process.env.META_APP_ID;
    const pageStatuses: PageStatus[] = [];

    for (const p of pages ?? []) {
      let subscribed = false;
      let subErr: string | null = null;
      let resubErr: string | null = null;
      let canResub = false;
      let formsCount = 0;
      let totalLeads = 0;
      const missingPageScopes: string[] = [];

      if (!p.page_access_token) {
        subErr = "Token-ul paginii lipsește. Reconectează contul Meta.";
      } else {
        // 1) subscribed_apps
        const pageToken = p.page_access_token!;
        try {
          const r = await fetch(
            `https://graph.facebook.com/${v}/${p.page_id}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`,
          );
          const j = await r.json();
          if (r.ok) {
            const apps: any[] = j?.data ?? [];
            const ours = apps.find((a) => String(a.id) === String(META_APP_ID));
            if (ours) {
              const fields: string[] = ours.subscribed_fields ?? [];
              subscribed = fields.includes("leadgen");
            }
          } else {
            subErr = j?.error?.message ?? `HTTP ${r.status}`;
            if (/pages_manage_metadata/i.test(subErr)) {
              missingPageScopes.push("pages_manage_metadata");
            }
          }
        } catch (e: any) {
          subErr = e?.message ?? "Eroare necunoscută";
        }

        // 2) Try to (re)subscribe automatically if not subscribed and we have the scope
        if (!subscribed && !missingPageScopes.length) {
          try {
            const r = await fetch(
              `https://graph.facebook.com/${v}/${p.page_id}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ subscribed_fields: "leadgen" }),
              },
            );
            const j = await r.json();
            if (r.ok && j?.success) {
              subscribed = true;
              canResub = true;
            } else {
              resubErr = j?.error?.message ?? `HTTP ${r.status}`;
              if (/pages_manage_metadata/i.test(resubErr)) {
                missingPageScopes.push("pages_manage_metadata");
              }
            }
          } catch (e: any) {
            resubErr = e?.message ?? "Eroare necunoscută";
          }
        }

        // 3) Lead forms count
        try {
          const r = await fetch(
            `https://graph.facebook.com/${v}/${p.page_id}/leadgen_forms?fields=id,leads_count&limit=200&access_token=${encodeURIComponent(pageToken)}`,
          );
          const j = await r.json();
          if (r.ok) {
            const forms: any[] = j?.data ?? [];
            formsCount = forms.length;
            totalLeads = forms.reduce((sum, f) => sum + Number(f.leads_count ?? 0), 0);
          }
        } catch {
          /* ignore */
        }
      }

      pageStatuses.push({
        page_id: p.page_id,
        page_name: p.page_name ?? p.page_id,
        subscribed_to_leadgen: subscribed,
        subscribed_apps_error: subErr,
        can_resubscribe: canResub,
        resubscribe_error: resubErr,
        leadgen_forms_count: formsCount,
        leadgen_total_leads: totalLeads,
        missing_page_scopes: Array.from(new Set(missingPageScopes)),
      });
    }

    return {
      connected: true,
      user_id: conn.meta_user_id ?? null,
      user_name: conn.meta_user_name ?? null,
      granted_scopes: granted,
      missing_scopes,
      declined_scopes: declined,
      pages: pageStatuses,
      webhook_callback_url,
      reconnect_url,
    };
  });