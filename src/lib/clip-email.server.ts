/**
 * Mailurile clipului cu paywall: „e gata”, reamintirea după 24 de ore și „n-a ieșit”.
 * Butonul duce direct în contul omului, fără cod (login-link.server).
 */
import { loginLink } from "./login-link.server";
import { sendUserEmail } from "./user-email.server";

export type ClipEmailKind = "ready" | "reminder" | "failed";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function clipEmail(p: { kind: ClipEmailKind; niche: string; line?: string | null; thumbUrl?: string | null; url: string }) {
  const niche = p.niche.toLowerCase();
  const copy = {
    ready: {
      subject: `Clipul pentru ${niche} e gata`,
      title: "Clipul tău e gata!",
      line: p.line || "L-am făcut din pozele tale, cu voce în română și subtitrări.",
      cta: "Vezi clipul",
    },
    reminder: {
      subject: `Clipul pentru ${niche} te așteaptă`,
      title: "Clipul tău te așteaptă",
      line: "L-am păstrat în contul tău. Vezi cum începe și deblochează-l când vrei.",
      cta: "Vezi clipul",
    },
    failed: {
      subject: `Clipul pentru ${niche} n-a ieșit de data asta`,
      title: "Clipul n-a ieșit de data asta",
      line: "A fost o problemă la generare și am încercat de două ori. Nu te costă nimic: intră în cont și îl refacem.",
      cta: "Refă clipul",
    },
  }[p.kind];
  const img = p.thumbUrl
    ? `<tr><td style="padding:24px 0 0"><a href="${esc(p.url)}"><img src="${esc(p.thumbUrl)}" width="280" alt="Clipul tău" style="display:block;margin:0 auto;width:280px;max-width:100%;border-radius:14px"></a></td></tr>`
    : "";
  const html = `<!doctype html><html lang="ro"><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#17171c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:18px"><tr><td style="padding:32px 24px;text-align:center">
<div style="font-size:20px;font-weight:700">AdPilot</div>
<h1 style="margin:24px 0 8px;font-size:26px;line-height:1.2">${esc(copy.title)}</h1>
<p style="margin:0;font-size:16px;line-height:1.5;color:#55555f">${esc(copy.line)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${img}</table>
<p style="margin:28px 0 0"><a href="${esc(p.url)}" style="display:inline-block;padding:14px 32px;background:#17171c;color:#fff;border-radius:999px;font-size:16px;font-weight:700;text-decoration:none">${esc(copy.cta)}</a></p>
</td></tr></table>
<p style="margin:20px 0 0;font-size:12px;color:#8b8b95">© AdPilot. Ai primit acest mesaj pentru că ai cerut un clip pe adpilot.ro.</p>
</td></tr></table></body></html>`;
  const text = `${copy.title}\n\n${copy.line}\n\n${copy.cta}: ${p.url}\n`;
  return { subject: copy.subject, html, text };
}

/** Trimite mailul; nu aruncă, ca o problemă de livrare să nu oprească clipul. */
export async function sendClipEmail(
  db: any,
  params: { userId: string; kind: ClipEmailKind; niche?: string | null; line?: string | null; thumbUrl?: string | null },
): Promise<boolean> {
  try {
    const { data: u } = await db.auth.admin.getUserById(params.userId);
    const to = u?.user?.email as string | undefined;
    const { isPlaceholderEmail } = await import("./phone-auth.server");
    if (!to || isPlaceholderEmail(to)) {
      console.warn("[clip-email] fără email real", params.userId);
      return false;
    }
    const m = clipEmail({
      kind: params.kind,
      niche: params.niche || "afacerea ta",
      line: params.line,
      thumbUrl: params.thumbUrl,
      url: loginLink(params.userId, "s"),
    });
    const r = await sendUserEmail(to, m.subject, m.text, m.html);
    if (!r.sent) console.error("[clip-email]", params.kind, params.userId, r.error);
    return r.sent;
  } catch (e) {
    console.error("[clip-email]", params.kind, params.userId, (e as Error).message);
    return false;
  }
}
