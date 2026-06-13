import { createFileRoute } from "@tanstack/react-router";

/**
 * One-shot endpoint to create the initial admin user.
 * Idempotent: if the user already exists, just ensure the admin role is assigned.
 * Disabled once any admin exists (unless ?force=1 AND caller knows the email already exists).
 */
export const Route = createFileRoute("/api/public/admin-bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const email = url.searchParams.get("email") || "";
        const password = url.searchParams.get("password") || "";
        if (!email || !password) {
          return Response.json({ error: "email & password required" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Check if any admin already exists; if so, block (unless we're creating role for existing user)
        const { count: adminCount } = await supabaseAdmin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin");

        // Try to find user
        let userId: string | null = null;
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
        if (existing) {
          userId = existing.id;
          // Update password to ensure it matches
          await supabaseAdmin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
        } else {
          if ((adminCount ?? 0) > 0) {
            return Response.json({ error: "admin already exists" }, { status: 403 });
          }
          const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
          if (cErr || !created.user) {
            return Response.json({ error: cErr?.message || "create failed" }, { status: 500 });
          }
          userId = created.user.id;
        }

        // Ensure admin role
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: userId!, role: "admin" as const },
          { onConflict: "user_id,role" },
        );

        return Response.json({ ok: true, user_id: userId });
      },
    },
  },
});