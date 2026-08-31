/**
 * Broadcast pe email către segmente de useri (ex. cei fără Facebook conectat).
 * Email branded, cu opțional un „proof" (rezultate reale) + CTA de conectare.
 * Reply-to poate fi setat ca răspunsurile („de ce n-am conectat") să ajungă la admin.
 */

const SUPPORT_PHONE = "0740274969";
const ONBOARDING_URL = "https://www.adpilot.ro/onboarding";
const LOGO_URL = "https://adpilot.ro/adpilot-logo.png";

/** Callout cu rezultate reale (școală de șoferi) — social proof. */
const PROOF_HTML = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
    <tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:18px 20px;">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#16a34a;font-weight:700;">Rezultat real · școală de șoferi</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td align="center" style="padding:4px;"><div style="font-size:26px;font-weight:800;color:#15803d;">72</div><div style="font-size:11px;color:#4a4a63;">lead-uri</div></td>
        <td align="center" style="padding:4px;"><div style="font-size:26px;font-weight:800;color:#15803d;">&lt;2,5 lei</div><div style="font-size:11px;color:#4a4a63;">pe lead</div></td>
        <td align="center" style="padding:4px;"><div style="font-size:26px;font-weight:800;color:#15803d;">126 lei</div><div style="font-size:11px;color:#4a4a63;">cheltuiți</div></td>
      </tr></table>
    </td></tr>
  </table>`;

const PROOF_TEXT =
  "\n\n📈 Rezultat real (școală de șoferi): 72 de lead-uri, sub 2,5 lei pe lead, din doar 126 lei cheltuiți.\n";

export function brandedBroadcastEmail(
  subject: string,
  message: string,
  includeProof: boolean,
): { html: string; text: string } {
  const paras = message
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bodyHtml = paras
    .map(
      (p) =>
        `<p style="font-size:15px;line-height:1.6;color:#4a4a63;margin:0 0 16px;">${p.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;box-shadow:0 2px 14px rgba(20,20,40,0.07);">
        <tr><td align="center" style="padding:34px 32px 6px;">
          <img src="${LOGO_URL}" width="118" alt="AdPilot" style="display:block;width:118px;height:auto;" />
        </td></tr>
        <tr><td style="padding:8px 36px 34px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#16162a;">
          <h1 style="font-size:22px;line-height:1.3;margin:0 0 14px;font-weight:700;color:#16162a;">${subject}</h1>
          ${bodyHtml}
          ${includeProof ? PROOF_HTML : ""}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr>
            <td style="border-radius:12px;background:linear-gradient(90deg,#6a4bff,#a24bff);">
              <a href="${ONBOARDING_URL}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Conectează Facebook și pornește →</a>
            </td>
          </tr></table>
          <p style="font-size:14px;line-height:1.6;color:#6b6b85;margin:0;">Spune-mi ce te oprește — răspunde direct la acest email sau sună-mă: <b style="color:#16162a;">${SUPPORT_PHONE}</b>.<br/><span style="color:#9a9ab0;">— Daniel, AdPilot</span></p>
        </td></tr>
      </table>
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;"><tr>
        <td align="center" style="padding:18px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#9a9ab0;font-size:12px;line-height:1.6;">
          AdPilot · <a href="https://adpilot.ro" style="color:#7c5cff;text-decoration:none;">adpilot.ro</a><br/>Tu conduci afacerea. AdPilot conduce reclamele.
        </td>
      </tr></table>
    </td></tr>
  </table>
</body></html>`;

  const text =
    `${paras.join("\n\n")}` +
    (includeProof ? PROOF_TEXT : "") +
    `\n\n👉 Conectează Facebook și pornește: ${ONBOARDING_URL}\n\nSpune-mi ce te oprește — răspunde la acest email sau sună-mă: ${SUPPORT_PHONE}.\n— Daniel, AdPilot`;

  return { html, text };
}

/** Strânge destinatarii după segment și trimite emailul. */
export async function runEmailBroadcast(params: {
  segment: "all" | "no_fb" | "no_campaign";
  subject: string;
  message: string;
  includeProof: boolean;
  replyTo?: string;
}): Promise<{ total: number; sent: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendUserEmail } = await import("@/lib/user-email.server");

  // Useri cu Facebook conectat / cu campanie (pentru filtrare pe segment) + conturi de test.
  const [{ data: conns }, { data: camps }, { data: testRows }] = await Promise.all([
    supabaseAdmin.from("meta_connections").select("user_id").eq("is_active", true),
    supabaseAdmin.from("campaigns").select("user_id"),
    (supabaseAdmin as any).from("profiles").select("id").eq("is_test", true),
  ]);
  const fbUsers = new Set((conns ?? []).map((c: any) => c.user_id));
  const campUsers = new Set((camps ?? []).map((c: any) => c.user_id));
  const testUsers = new Set((testRows ?? []).map((r: any) => r.id));

  const { html, text } = brandedBroadcastEmail(params.subject, params.message, params.includeProof);

  const seen = new Set<string>();
  let total = 0;
  let sent = 0;
  let failed = 0;

  for (let page = 1; page <= 8; page++) {
    const { data } = await (supabaseAdmin as any).auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    if (!users.length) break;
    for (const u of users) {
      const email: string | undefined = u.email;
      if (!email || !u.email_confirmed_at) continue; // doar reali (confirmați)
      if (email.endsWith("@adpilot.ro") || email.endsWith("@pending.adpilot.ro")) continue;
      if (testUsers.has(u.id)) continue; // sărim conturile de test
      if (seen.has(email)) continue;
      // Segment
      if (params.segment === "no_fb" && fbUsers.has(u.id)) continue;
      if (params.segment === "no_campaign" && campUsers.has(u.id)) continue;
      seen.add(email);
      total++;
      const r = await sendUserEmail(email, params.subject, text, html, { replyTo: params.replyTo });
      if (r.sent) sent++;
      else failed++;
    }
    if (users.length < 200) break;
  }
  return { total, sent, failed };
}
