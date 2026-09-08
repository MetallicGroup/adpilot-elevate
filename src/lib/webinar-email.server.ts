/**
 * Invitație webinar pe email către o listă externă importată (webinar_email_contacts).
 * Design branded dark, logo real, link de înregistrare WebinarJam. Trimite prin Resend
 * (sendUserEmail) în loturi, marchează status per contact. Server-only.
 */

const LOGO_URL = "https://adpilot.ro/adpilot-logo.png";
const REGISTER_URL =
  "https://event.webinarjam.com/k50log/register/6mn981sg?webinar_id=5";
const UNSUB = "mailto:noreply@adpilot.ro?subject=Dezabonare%20webinar";

/** Emailul de invitație. `subject` = subiectul plicului (separat de titlul din corp). */
export function webinarInviteEmail(subject: string): { html: string; text: string } {
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#ececf2;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">13 septembrie, 19:30 — live și gratuit. Îți arăt cum AdPilot îți face reclamele singur.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ececf2;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#120e22;background-image:linear-gradient(160deg,#1a1330,#120e22 60%);border-radius:22px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;box-shadow:0 20px 50px -20px rgba(30,12,60,.4);">
        <tr><td align="center" style="background:#ffffff;padding:26px 40px;">
          <img src="${LOGO_URL}" width="120" alt="AdPilot" style="display:block;width:120px;height:auto;" />
        </td></tr>
        <tr><td style="height:5px;background:linear-gradient(90deg,#8b5cf6,#e0559b);"></td></tr>
        <tr><td align="center" style="padding:34px 40px 0;">
          <span style="display:inline-block;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c8b6ff;background:rgba(139,92,246,.16);border:1px solid rgba(139,92,246,.35);border-radius:999px;padding:7px 15px;font-weight:700;">● Webinar gratuit · live</span>
        </td></tr>
        <tr><td align="center" style="padding:20px 46px 0;">
          <h1 style="margin:0;font-size:38px;line-height:1.08;font-weight:800;color:#ffffff;letter-spacing:-.5px;">Clienți din reclame,<br /><span style="color:#c9a9ff;">fără agenție și fără experiență.</span></h1>
        </td></tr>
        <tr><td align="center" style="padding:18px 52px 0;">
          <p style="margin:0;font-size:16px;line-height:1.6;color:#c3bcdf;">Pe <b style="color:#ffffff;">13 septembrie</b> îți arăt <b style="color:#ffffff;">LIVE</b> cum AdPilot îți creează, lansează și optimizează reclamele pe Facebook &amp; Instagram — iar tu doar vorbești pe WhatsApp.</p>
        </td></tr>
        <tr><td align="center" style="padding:24px 40px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);border-radius:14px;"><tr>
            <td style="padding:14px 22px;font-size:15px;color:#ffffff;font-weight:600;">📅 13 septembrie&nbsp;&nbsp;·&nbsp;&nbsp;🕢 19:30&nbsp;&nbsp;·&nbsp;&nbsp;💻 online</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px 48px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:9px 0;color:#e8e4f7;font-size:15px;line-height:1.5;"><span style="color:#a78bfa;font-weight:800;">➜</span>&nbsp; Cum pornești o reclamă care aduce clienți <b style="color:#fff;">în 5 minute</b>, de pe telefon</td></tr>
            <tr><td style="padding:9px 0;color:#e8e4f7;font-size:15px;line-height:1.5;"><span style="color:#25d366;font-weight:800;">➜</span>&nbsp; Cum îți vin lead-urile <b style="color:#fff;">direct pe WhatsApp</b>, gestionate cu AI</td></tr>
            <tr><td style="padding:9px 0;color:#e8e4f7;font-size:15px;line-height:1.5;"><span style="color:#c9a9ff;font-weight:800;">➜</span>&nbsp; Greșeala nr. 1 care îți <b style="color:#fff;">arde bugetul</b> — și cum o eviți</td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:32px 40px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td align="center" style="border-radius:14px;background-image:linear-gradient(90deg,#8b5cf6,#e0559b);">
              <a href="${REGISTER_URL}" style="display:inline-block;padding:17px 40px;font-size:17px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:14px;">Rezervă-mi locul gratuit  →</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding:12px 40px 0;">
          <p style="margin:0;font-size:13px;color:#8f88b0;">Locuri limitate · înregistrare gratuită · durează 60 sec</p>
        </td></tr>
        <tr><td style="padding:30px 48px 0;">
          <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:20px;">
            <p style="margin:0;font-size:14px;line-height:1.6;color:#b3accf;"><b style="color:#fff;">P.S.</b> Dacă ai încercat vreodată să faci reclame singur și te-ai pierdut prin butoane — exact asta rezolvăm. Vino live, pui întrebări, pleci cu prima reclamă gata.</p>
            <p style="margin:16px 0 0;font-size:14px;color:#8f88b0;">Ne vedem acolo,<br /><b style="color:#fff;">Daniel · AdPilot</b></p>
          </div>
        </td></tr>
        <tr><td style="height:34px;"></td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;"><tr>
        <td align="center" style="padding:20px 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#9a95ac;font-size:12px;line-height:1.6;">
          AdPilot · <a href="https://adpilot.ro" style="color:#7c5cff;text-decoration:none;">adpilot.ro</a><br />Tu conduci afacerea. AdPilot conduce reclamele.<br />
          <a href="${UNSUB}" style="color:#9a95ac;text-decoration:underline;">Dezabonare</a>
        </td>
      </tr></table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Webinar gratuit · LIVE — 13 septembrie, 19:30 (online)

Clienți din reclame, fără agenție și fără experiență.

Pe 13 septembrie îți arăt LIVE cum AdPilot îți creează, lansează și optimizează reclamele pe Facebook & Instagram — iar tu doar vorbești pe WhatsApp.

➜ Cum pornești o reclamă care aduce clienți în 5 minute, de pe telefon
➜ Cum îți vin lead-urile direct pe WhatsApp, gestionate cu AI
➜ Greșeala nr. 1 care îți arde bugetul — și cum o eviți

Rezervă-mi locul gratuit → ${REGISTER_URL}

Ne vedem acolo,
Daniel · AdPilot
Dezabonare: ${UNSUB}`;

  // subject e folosit doar la plic (envelope), nu în corp — dar îl referențiem ca să
  // nu fie „unused" dacă vrei să-l injectezi ulterior în corp.
  void subject;
  return { html, text };
}

/** Trimite invitația către contactele 'pending' din webinar_email_contacts, în loturi. */
export async function runWebinarEmailBlast(params: {
  subject: string;
  limit: number;
  replyTo?: string;
}): Promise<{ total: number; pending: number; sent: number; failed: number; remaining: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendUserEmail } = await import("@/lib/user-email.server");
  const { html, text } = webinarInviteEmail(params.subject);

  const { data: rows } = await (supabaseAdmin as any)
    .from("webinar_email_contacts")
    .select("id, email")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(params.limit);

  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const r = await sendUserEmail(row.email, params.subject, text, html, {
      replyTo: params.replyTo,
    });
    await (supabaseAdmin as any)
      .from("webinar_email_contacts")
      .update(
        r.sent
          ? { status: "sent", sent_at: new Date().toISOString(), error: null }
          : { status: "failed", error: (r.error ?? "unknown").slice(0, 300) },
      )
      .eq("id", row.id);
    if (r.sent) sent++;
    else failed++;
  }

  const { count: total } = await (supabaseAdmin as any)
    .from("webinar_email_contacts")
    .select("id", { count: "exact", head: true });
  const { count: remaining } = await (supabaseAdmin as any)
    .from("webinar_email_contacts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return {
    total: total ?? 0,
    pending: remaining ?? 0,
    sent,
    failed,
    remaining: remaining ?? 0,
  };
}
