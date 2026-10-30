/**
 * Alegerea automată a contului de reclame și a paginii de Facebook pe care facem reclame.
 * Pur (fără apeluri): primește ce a întors Meta și ce știm despre afacere.
 *
 * Contul de reclame: activ + card + lei > activ + card > activ > cu datorie (se poate plăti) > restul.
 * Pagina: păstrăm alegerea existentă; altfel cea care se potrivește cu afacerea (nișa din /start);
 * dacă sunt mai multe și niciuna nu iese clar în față, botul îl întreabă pe om.
 */

export type AdAccountCandidate = {
  account_id: string;
  account_status?: number | string | null;
  currency?: string | null;
  amount_spent?: string | number | null;
  funding_source_details?: { id?: string; display_string?: string; type?: number } | null;
};

export function adAccountScore(a: AdAccountCandidate): number {
  const status = Number(a.account_status);
  const f = a.funding_source_details;
  const hasCard = !!(f && (f.id || f.display_string || typeof f.type === "number"));
  let score = 0;
  if (status === 1) score += 100;
  else if (status === 3 || status === 9 || status === 8) score += 40; // datorie / plată în curs: se poate repara
  else if (status === 7) score += 30; // în verificare
  if (hasCard) score += 20;
  if ((a.currency ?? "").toUpperCase() === "RON") score += 10;
  const spent = Number(a.amount_spent ?? 0);
  if (spent > 0) score += Math.min(5, Math.log10(spent + 1));
  return score;
}

export function isRunnableStatus(status: unknown): boolean {
  return Number(status) === 1;
}

/** Contul de reclame ales: cel curent dacă e încă activ, altfel cel mai bun. */
export function pickAdAccount(accounts: AdAccountCandidate[], currentId?: string | null): string | null {
  if (!accounts.length) return null;
  const current = currentId ? accounts.find((a) => a.account_id === currentId) : null;
  if (current && isRunnableStatus(current.account_status)) return current.account_id;
  return [...accounts].sort((a, b) => adAccountScore(b) - adAccountScore(a))[0]!.account_id;
}

export type PageCandidate = { id: string; name?: string | null; category?: string | null };

function words(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
}

/** Cât de bine se potrivește pagina cu ce știm despre afacere (nișa, orașul, numele spus în chat). */
export function pageMatchScore(page: PageCandidate, hints: string[]): number {
  const hay = new Set(words(`${page.name ?? ""} ${page.category ?? ""}`));
  let score = 0;
  for (const h of hints) for (const w of words(h)) if (hay.has(w) || [...hay].some((x) => x.startsWith(w.slice(0, 5)))) score++;
  return score;
}

/**
 * Pagina aleasă + dacă trebuie confirmată de om.
 * `needsChoice` = are mai multe pagini și niciuna nu se potrivește clar.
 */
export function pickPage(
  pages: PageCandidate[],
  hints: string[],
  currentId?: string | null,
): { pageId: string | null; needsChoice: boolean } {
  if (!pages.length) return { pageId: null, needsChoice: false };
  if (currentId && pages.some((p) => p.id === currentId)) return { pageId: currentId, needsChoice: false };
  if (pages.length === 1) return { pageId: pages[0]!.id, needsChoice: false };
  const scored = pages.map((p) => ({ id: p.id, s: pageMatchScore(p, hints) })).sort((a, b) => b.s - a.s);
  const [top, second] = scored;
  if (top!.s > 0 && top!.s > (second?.s ?? 0)) return { pageId: top!.id, needsChoice: false };
  return { pageId: scored[0]!.id, needsChoice: true };
}
