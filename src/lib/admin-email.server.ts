/**
 * Notificări email către owner-ul AdPilot (plasă de siguranță pentru WhatsApp).
 * Trimite direct prin Resend. Server-only. Best-effort: nu aruncă.
 */

/** Adresa owner-ului. Override cu ADPILOT_ADMIN_EMAIL. */
export function getAdminEmail(): string {
  return process.env.ADPILOT_ADMIN_EMAIL || "danudda2810@gmail.com";
}

export type AdminEmailResult = { sent: boolean; error?: string };

export async function sendAdminEmail(subject: string, text: string): Promise<AdminEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[admin-email] RESEND_API_KEY lipsă — email sărit");
    return { sent: false, error: "resend_not_configured" };
  }
  const from = process.env.EMAIL_FROM || "AdPilot <noreply@adpilot.ro>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: getAdminEmail(), subject, text }),
    });
    if (!r.ok) {
      let message = `Resend error (${r.status})`;
      try {
        const j = (await r.json()) as { message?: string; error?: { message?: string } };
        message = j?.message || j?.error?.message || message;
      } catch {
        /* non-JSON */
      }
      console.error("[admin-email] send failed:", message);
      return { sent: false, error: message };
    }
    return { sent: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[admin-email] send failed:", e);
    return { sent: false, error: err };
  }
}
