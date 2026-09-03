import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "agentie"
  );
}

/** Date publice ale unei agenții după slug (pentru pagina /connect/[slug]). */
export const getAgencyPublic = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => {
    const slug = String((raw as any)?.slug ?? "").trim().toLowerCase();
    if (!slug) throw new Error("slug lipsă");
    return { slug };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin: __sa } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin: any = __sa;
    const { data: ag } = await supabaseAdmin
      .from("agencies")
      .select("name, slug, logo_url, white_label_enabled")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!ag) return { agency: null };
    return {
      agency: {
        name: ag.name,
        slug: ag.slug,
        logo_url: ag.white_label_enabled ? ag.logo_url : null,
        white_label: ag.white_label_enabled,
      },
    };
  });

/** Creează contul de agenție (setează account_type=agency + rând în agencies). */
export const createAgency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const name = String((raw as any)?.name ?? "").trim();
    if (name.length < 2) throw new Error("Introdu numele agenției.");
    return { name: name.slice(0, 80) };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin: __sa } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin: any = __sa;

    const { data: existing } = await supabaseAdmin
      .from("agencies")
      .select("id, slug")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (existing) return { ok: true as const, id: existing.id, slug: existing.slug };

    let base = slugify(data.name);
    let slug = base;
    for (let i = 0; i < 6; i++) {
      const { data: taken } = await supabaseAdmin
        .from("agencies")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!taken) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const { data: ag, error } = await supabaseAdmin
      .from("agencies")
      .insert({ owner_user_id: userId, name: data.name, slug })
      .select("id, slug")
      .single();
    if (error || !ag) throw new Error(error?.message ?? "Nu am putut crea agenția.");

    await (supabaseAdmin as any).from("profiles").update({ account_type: "agency" }).eq("id", userId);
    return { ok: true as const, id: ag.id, slug: ag.slug };
  });

/** Agenția userului logat (sau null). */
export const getMyAgency = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getOwnerAgency } = await import("@/lib/agency.server");
    return { agency: (await getOwnerAgency(context.userId)) ?? null };
  });

/** Lista clienților + statistici LIVE de azi (spend/leaduri) + sloturi. */
export const getAgencyClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: __sa } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin: any = __sa;
    const { getOwnerAgency, clientAccountInsights } = await import("@/lib/agency.server");
    const ag = await getOwnerAgency(context.userId);
    if (!ag) return { agency: null, clients: [], slots: { used: 0, total: 0 } };

    const { data: rows } = await supabaseAdmin
      .from("agency_clients")
      .select(
        "id, client_name, facebook_page_name, ad_account_id, ad_account_name, access_token, status, connected_at, created_at",
      )
      .eq("agency_id", ag.id)
      .order("created_at", { ascending: false });

    const clients = await Promise.all(
      (rows ?? []).map(async (c: any) => {
        let leadsToday = 0;
        let spendToday = 0;
        if (c.status === "connected" && c.access_token && c.ad_account_id) {
          try {
            const s = await clientAccountInsights(c.access_token, c.ad_account_id, "today");
            leadsToday = s.leads;
            spendToday = s.spend;
          } catch {
            /* live fetch best-effort */
          }
        }
        return {
          id: c.id,
          client_name: c.client_name,
          facebook_page_name: c.facebook_page_name,
          ad_account_name: c.ad_account_name,
          status: c.status,
          connected_at: c.connected_at,
          leadsToday,
          spendToday,
        };
      }),
    );

    const connected = (rows ?? []).filter((c: any) => c.status === "connected").length;
    const included = ag.client_slots ?? 2;
    return {
      agency: { name: ag.name, slug: ag.slug, white_label_enabled: ag.white_label_enabled },
      clients,
      slots: { connected, included, extra: Math.max(0, connected - included), extraPrice: 249 },
    };
  });

/** Dashboard LIVE pentru un client (verifică proprietatea). */
export const getClientDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const id = String((raw as any)?.client_id ?? "");
    if (!id) throw new Error("client_id lipsă");
    return { client_id: id };
  })
  .handler(async ({ data, context }) => {
    const { getClientForOwner, clientAccountInsights, clientCampaigns } = await import(
      "@/lib/agency.server"
    );
    const client = await getClientForOwner(context.userId, data.client_id);
    if (!client) throw new Error("Client negăsit sau nu îți aparține.");
    if (client.status !== "connected" || !client.access_token || !client.ad_account_id) {
      return {
        client: {
          id: client.id,
          name: client.client_name,
          page: client.facebook_page_name,
          ad_account: client.ad_account_name,
          status: client.status,
        },
        connected: false as const,
      };
    }
    const [today, last7, life, campaigns] = await Promise.all([
      clientAccountInsights(client.access_token, client.ad_account_id, "today"),
      clientAccountInsights(client.access_token, client.ad_account_id, "last_7d"),
      clientAccountInsights(client.access_token, client.ad_account_id, "maximum"),
      clientCampaigns(client.access_token, client.ad_account_id),
    ]);
    return {
      client: {
        id: client.id,
        name: client.client_name,
        page: client.facebook_page_name,
        ad_account: client.ad_account_name,
        status: client.status,
      },
      connected: true as const,
      stats: { today, last7, life },
      campaigns,
    };
  });

/** Setări curente ale agenției (pentru pagina /agency/settings). */
export const getAgencySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getOwnerAgency } = await import("@/lib/agency.server");
    const ag = await getOwnerAgency(context.userId);
    if (!ag) return { agency: null };
    return {
      agency: {
        name: ag.name,
        slug: ag.slug,
        logo_url: ag.logo_url,
        white_label_enabled: ag.white_label_enabled,
      },
    };
  });

/** Editează numele și/sau slug-ul (cu verificare de unicitate). */
export const updateAgency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { name?: string; slug?: string };
    const name = d.name !== undefined ? String(d.name).trim() : undefined;
    const slug = d.slug !== undefined ? String(d.slug).trim().toLowerCase() : undefined;
    if (name !== undefined && (name.length < 2 || name.length > 80))
      throw new Error("Numele trebuie să aibă 2–80 caractere.");
    if (slug !== undefined && !/^[a-z0-9-]{2,40}$/.test(slug))
      throw new Error("Slug invalid: doar litere mici, cifre și cratime (2–40).");
    return { name, slug };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: __sa } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin: any = __sa;
    const { data: ag } = await supabaseAdmin
      .from("agencies")
      .select("id")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!ag) throw new Error("Nu ai o agenție.");
    if (data.slug !== undefined) {
      const { data: taken } = await supabaseAdmin
        .from("agencies")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", ag.id)
        .maybeSingle();
      if (taken) throw new Error("Acest slug este deja folosit. Alege altul.");
    }
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("agencies").update(patch).eq("id", ag.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

/** Upload logo agenție (doar cu white-label activat). Imagine ca data URL base64. */
export const uploadAgencyLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const dataUrl = String((raw as any)?.dataUrl ?? "");
    if (!dataUrl.startsWith("data:image/")) throw new Error("Trimite o imagine.");
    if (dataUrl.length > 2_500_000) throw new Error("Imagine prea mare (max ~1.8MB).");
    return { dataUrl };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: __sa } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin: any = __sa;
    const { data: ag } = await supabaseAdmin
      .from("agencies")
      .select("id, white_label_enabled")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!ag) throw new Error("Nu ai o agenție.");
    if (!ag.white_label_enabled)
      throw new Error("Logo-ul e disponibil doar cu white-label activat.");
    const m = data.dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i);
    if (!m) throw new Error("Format de imagine invalid.");
    const mime = m[1];
    const ext = mime.split("/")[1].split("+")[0];
    const bytes = Buffer.from(m[2], "base64");
    const path = `agency/${ag.id}/logo_${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("profile-photos")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabaseAdmin.storage.from("profile-photos").getPublicUrl(path);
    await supabaseAdmin.from("agencies").update({ logo_url: pub.publicUrl }).eq("id", ag.id);
    return { ok: true as const, url: pub.publicUrl as string };
  });

/** Dezactivează white-label (activarea se face doar prin plata add-on-ului). */
export const disableWhiteLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: __sa } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin: any = __sa;
    const { error } = await supabaseAdmin
      .from("agencies")
      .update({ white_label_enabled: false })
      .eq("owner_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Deconectează un client: șterge tokenul, status=disconnected. */
export const disconnectAgencyClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const id = String((raw as any)?.client_id ?? "");
    if (!id) throw new Error("client_id lipsă");
    return { client_id: id };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: __sa } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin: any = __sa;
    const { getClientForOwner } = await import("@/lib/agency.server");
    const client = await getClientForOwner(context.userId, data.client_id);
    if (!client) throw new Error("Client negăsit sau nu îți aparține.");
    const { error } = await supabaseAdmin
      .from("agency_clients")
      .update({ status: "disconnected", access_token: null })
      .eq("id", data.client_id);
    if (error) throw new Error(error.message);
    // Scade cantitatea facturată (un client mai puțin).
    try {
      const { syncAgencyBilling } = await import("@/lib/agency-billing.server");
      await syncAgencyBilling(client.agency_id);
    } catch {
      /* best-effort */
    }
    return { ok: true as const };
  });
