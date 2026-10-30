/**
 * Closer, nivelul 1: patronul răspunde leadului într-o singură apăsare, de pe WhatsApp-ul LUI.
 *
 *  1. Lead nou → mesaj cu un link wa.me care deschide chatul cu leadul, cu mesajul deja scris,
 *     plus butoanele [Am vorbit ✅] [Nu răspunde].
 *  2. După 10 minute fără răspuns la butoane → o reamintire (lead-urile contactate repede se închid mai des).
 *  3. A doua zi → „A venit?” cu [A venit ✅] [Are programare] [N-a venit]. Așa raportăm clienți, nu lead-uri.
 *
 * Nu scriem niciodată leadului de pe numărul AdPilot: el a cerut oferta afacerii, nu nouă.
 */
import { notifyOwner, isQuietHours } from "./wa-notify.server";

const REMIND_AFTER_MS = 10 * 60 * 1000;
const REMIND_UNTIL_MS = 2 * 60 * 60 * 1000;
const OUTCOME_AFTER_MS = 18 * 60 * 60 * 1000;
const OUTCOME_UNTIL_MS = 72 * 60 * 60 * 1000;

type LeadForCloser = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

/** „0722 123 456” / „+40722123456” → „40722123456” (pentru wa.me). */
export function waDigits(phone?: string | null): string | null {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (d.startsWith("0040")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = `4${d}`;
  if (d.length === 9 && d.startsWith("7")) d = `40${d}`;
  return d.length >= 10 ? d : null;
}

function firstName(full?: string | null): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Linkul care deschide chatul patronului cu leadul, cu primul mesaj gata scris. */
export function leadChatLink(lead: LeadForCloser, business: string | null, offer: string | null): string | null {
  const d = waDigits(lead.phone);
  if (!d) return null;
  const name = firstName(lead.full_name);
  const text = [
    `Bună${name ? `, ${name}` : ""}!`,
    business ? `Sunt de la ${business}.` : "",
    offer ? `Ai cerut detalii despre: ${offer}.` : "Ai cerut detalii prin reclama noastră.",
    "Când ți-ar conveni să stabilim?",
  ]
    .filter(Boolean)
    .join(" ");
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/** Mesajul pentru patron la un lead nou (cu link și butoane). */
export async function notifyNewLead(
  supabaseAdmin: any,
  userId: string,
  input: {
    lead: LeadForCloser & { email?: string | null };
    business: string | null;
    offer: string | null;
    campaignName: string | null;
    answers: Array<{ q: string; a: string }>;
  },
) {
  const { lead } = input;
  const link = leadChatLink(lead, input.business, input.offer);
  const lines = [
    "🎯 *Client nou!*",
    lead.full_name ? `👤 *${lead.full_name}*` : "",
    lead.phone ? `📞 ${lead.phone}` : "",
    lead.email ? `✉️ ${lead.email}` : "",
    input.campaignName ? `📣 _${input.campaignName}_` : "",
    ...(input.answers.length ? ["", ...input.answers.map((x) => `• ${x.q}: *${x.a}*`)] : []),
    "",
    link
      ? `👉 Scrie-i acum, mesajul e deja scris: ${link}`
      : "👉 Sună-l acum: lead-urile contactate în primele 5 minute se transformă mult mai des în clienți.",
  ]
    .filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n");
  const res = await notifyOwner(supabaseAdmin, userId, {
    text: lines,
    holdIfClosed: true,
    kind: "lead_notify",
    buttons: [
      { id: `lead:contacted:${lead.id}`, title: "Am vorbit ✅" },
      { id: `lead:noanswer:${lead.id}`, title: "Nu răspunde" },
    ],
    meta: { lead_id: lead.id },
  });
  await supabaseAdmin
    .from("leads")
    .update({ followup: { notified_at: new Date().toISOString(), notify: Object.keys(res)[0] } })
    .eq("id", lead.id);
  return res;
}

/** Cron (la ~5 minute): reamintirea de la 10 minute și întrebarea „A venit?” de a doua zi. */
export async function runLeadFollowups(supabaseAdmin: any): Promise<{ reminded: number; asked: number }> {
  const now = Date.now();
  let reminded = 0;
  let asked = 0;

  // 1) Reamintire: lead nou, fără răspuns la butoane, între 10 minute și 2 ore.
  const { data: fresh } = await supabaseAdmin
    .from("leads")
    .select("id, user_id, full_name, phone, created_at, followup, campaign_id")
    .eq("status", "new")
    .gte("created_at", new Date(now - REMIND_UNTIL_MS).toISOString())
    .lte("created_at", new Date(now - REMIND_AFTER_MS).toISOString())
    .limit(50);
  for (const l of (fresh ?? []) as any[]) {
    const f = l.followup ?? {};
    if (!f.notified_at || f.reminded_at || f.answer) continue;
    const { business, offer } = await leadContext(supabaseAdmin, l);
    const link = leadChatLink(l, business, offer);
    const mins = Math.round((now - new Date(l.created_at).getTime()) / 60000);
    const r = await notifyOwner(supabaseAdmin, l.user_id, {
      text:
        `⏰ *${l.full_name ?? "Clientul nou"}* așteaptă de ${mins} de minute.\n` +
        `Cei contactați în primele minute vin mult mai des.${link ? `\n👉 ${link}` : l.phone ? `\n📞 ${l.phone}` : ""}`,
      kind: "lead_reminder",
      buttons: [
        { id: `lead:contacted:${l.id}`, title: "Am vorbit ✅" },
        { id: `lead:noanswer:${l.id}`, title: "Nu răspunde" },
      ],
    });
    await supabaseAdmin
      .from("leads")
      .update({ followup: { ...f, reminded_at: new Date().toISOString() } })
      .eq("id", l.id);
    if ("sent" in r) reminded++;
  }

  // 2) A doua zi: „A venit?” (doar între 10:00 și 20:00, ora României).
  if (!isQuietHours() && bucharestHour() < 20 && bucharestHour() >= 10) {
    const { data: old } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, full_name, phone, created_at, followup, status")
      .in("status", ["new", "contacted"])
      .gte("created_at", new Date(now - OUTCOME_UNTIL_MS).toISOString())
      .lte("created_at", new Date(now - OUTCOME_AFTER_MS).toISOString())
      .limit(50);
    for (const l of (old ?? []) as any[]) {
      const f = l.followup ?? {};
      if (!f.notified_at || f.outcome_asked_at || f.outcome) continue;
      const r = await notifyOwner(supabaseAdmin, l.user_id, {
        text: `Ieri ți-a lăsat datele *${l.full_name ?? "un client"}*${l.phone ? ` (${l.phone})` : ""}. A venit sau are programare?`,
        kind: "lead_outcome",
        buttons: [
          { id: `lead:won:${l.id}`, title: "A venit ✅" },
          { id: `lead:booked:${l.id}`, title: "Are programare" },
          { id: `lead:lost:${l.id}`, title: "N-a venit" },
        ],
      });
      await supabaseAdmin
        .from("leads")
        .update({ followup: { ...f, outcome_asked_at: new Date().toISOString() } })
        .eq("id", l.id);
      if ("sent" in r) asked++;
    }
  }
  return { reminded, asked };
}

function bucharestHour(d = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Bucharest" }).format(d));
}

/** Numele afacerii (pagina) și oferta (titlul reclamei) pentru mesajul gata scris. */
export async function leadContext(
  supabaseAdmin: any,
  lead: { user_id: string; campaign_id?: string | null },
): Promise<{ business: string | null; offer: string | null }> {
  const [{ data: page }, { data: camp }] = await Promise.all([
    supabaseAdmin.from("meta_pages").select("page_name").eq("user_id", lead.user_id).eq("is_active", true).limit(1).maybeSingle(),
    lead.campaign_id
      ? supabaseAdmin.from("campaigns").select("name, creative").eq("id", lead.campaign_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    business: page?.page_name ?? null,
    offer: (camp?.creative as any)?.headline ?? camp?.name ?? null,
  };
}

const ANSWERS: Record<string, { status?: string; reply: string; key: string }> = {
  contacted: { status: "contacted", reply: "Notat ✅ Mâine te întreb dacă a venit, ca să vedem câți clienți reali aduce reclama.", key: "contacted" },
  noanswer: { reply: "Notat. Încearcă-l din nou diseară sau mâine dimineață — mulți răspund la al doilea mesaj.", key: "no_answer" },
  won: { status: "won", reply: "Super! 🎉 Îl număr la clienți câștigați din reclamă.", key: "won" },
  booked: { status: "appointment_scheduled", reply: "Notat: are programare ✅", key: "booked" },
  lost: { status: "lost", reply: "Notat. Dacă mai multe lead-uri nu vin, îți propun ce schimbăm la reclamă sau la mesaj.", key: "lost" },
};

/**
 * Butoanele din mesajele de lead (id „lead:<acțiune>:<leadId>”). Întoarce răspunsul scurt pentru patron,
 * sau null dacă id-ul nu e al nostru.
 */
export async function handleLeadButton(supabaseAdmin: any, userId: string, replyId: string): Promise<string | null> {
  const m = /^lead:(contacted|noanswer|won|booked|lost):([0-9a-f-]{36})$/i.exec(replyId ?? "");
  if (!m) return null;
  const a = ANSWERS[m[1]!.toLowerCase()]!;
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, followup")
    .eq("id", m[2])
    .eq("user_id", userId)
    .maybeSingle();
  if (!lead) return "Nu mai găsesc lead-ul ăsta.";
  const f = (lead.followup ?? {}) as Record<string, unknown>;
  const update: Record<string, unknown> = {
    followup: {
      ...f,
      ...(["won", "booked", "lost"].includes(a.key) ? { outcome: a.key, outcome_at: new Date().toISOString() } : { answer: a.key, answer_at: new Date().toISOString() }),
    },
  };
  if (a.status) update.status = a.status;
  await supabaseAdmin.from("leads").update(update).eq("id", lead.id);
  return a.reply;
}
