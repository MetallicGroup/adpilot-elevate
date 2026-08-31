/**
 * Trimite email către un user (lifecycle/activare), prin Resend. Server-only.
 * Best-effort: dacă lipsește RESEND_API_KEY sau pică, întoarce {sent:false}.
 */
export async function sendUserEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
  opts?: { replyTo?: string },
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "resend_not_configured" };
  if (!to || !/.+@.+\..+/.test(to)) return { sent: false, error: "invalid_email" };
  const from = process.env.EMAIL_FROM || "AdPilot <noreply@adpilot.ro>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
        ...(html ? { html } : {}),
        ...(opts?.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!r.ok) {
      let message = `Resend error (${r.status})`;
      try {
        const j = (await r.json()) as { message?: string; error?: { message?: string } };
        message = j?.message || j?.error?.message || message;
      } catch {
        /* non-JSON */
      }
      return { sent: false, error: message };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
