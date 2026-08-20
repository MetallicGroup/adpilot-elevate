/**
 * Config pentru landing-urile de nișă (/beauty, /dentist, ...). Client-safe.
 * Fiecare nișă e o intrare aici; ruta (ex. src/routes/beauty.tsx) doar randează
 * <NicheLanding niche={NICHES.beauty} />. IMPORTANT: doar Facebook & Instagram
 * (fără Google — nu e în produs).
 */

export type ChatLine = { from: "me" | "bot"; text: string };

export type NicheConfig = {
  slug: string;
  contentId: string; // pt. TikTok ViewContent
  meta: { title: string; description: string };
  hero: {
    badge: string;
    titlePre: string;
    titleHighlight: string;
    titlePost: string;
    subtitle: string;
    ctaLabel: string;
  };
  socialProof: string;
  problem: { title: string; items: string[] };
  demo: { title: string; lines: ChatLine[] };
  steps: { title: string; desc: string }[];
  faq: { q: string; a: string }[];
};

export const NICHES: Record<string, NicheConfig> = {
  beauty: {
    slug: "beauty",
    contentId: "oferta-beauty",
    meta: {
      title: "Mai multe cliente la salon — AdPilot",
      description:
        "AdPilot trimite programări noi direct pe WhatsApp-ul tău — reclame Facebook și Instagram automate pentru salonul tău. Fără agenție, fără experiență. Începe gratuit.",
    },
    hero: {
      badge: "Pentru saloane · coafor · unghii · beauty",
      titlePre: "Mai multe ",
      titleHighlight: "cliente la salon",
      titlePost: ".",
      subtitle:
        "AdPilot trimite programări noi direct pe WhatsApp-ul tău — automat, în fiecare zi. Reclame pe Facebook și Instagram, fără agenție și fără experiență.",
      ctaLabel: "Vreau mai multe programări",
    },
    socialProof: "Alătură-te saloanelor din România care pornesc reclame cu AdPilot 🇷🇴",
    problem: {
      title: "Ești proprietar de salon și…",
      items: [
        "Ai zile în care scaunele stau goale, dar nu știi de unde să aduci cliente noi.",
        "Ai încercat postări pe Instagram, dar nu ți-au adus programări reale.",
        "N-ai timp (și nici chef) să înveți Facebook Ads Manager sau să plătești o agenție scumpă.",
      ],
    },
    demo: {
      title: "Așa pornești o reclamă — dintr-o conversație pe WhatsApp",
      lines: [
        { from: "me", text: "Vreau mai multe cliente la salon" },
        { from: "bot", text: "Perfect! Pornesc o reclamă pentru salonul tău pe Facebook și Instagram. Ce buget zilnic pui?" },
        { from: "me", text: "50 lei pe zi" },
        { from: "bot", text: "Gata, reclama e live! 🎉 Îți trimit aici fiecare programare nouă." },
        { from: "bot", text: "📩 Programare nouă: Andreea, 0722… — vrea manichiură sâmbătă la 14:00" },
      ],
    },
    steps: [
      { title: "Conectezi Facebook", desc: "Legi pagina salonului în câteva secunde." },
      { title: "Spui ce vrei", desc: "„Vreau mai multe cliente la salon” — atât, în română." },
      { title: "Primești programări", desc: "Fiecare clientă interesată îți vine direct pe WhatsApp." },
    ],
    faq: [
      { q: "Trebuie să știu ceva despre reclame?", a: "Nu. Îi spui pe WhatsApp ce vrei („mai multe cliente”), iar AdPilot creează, lansează și optimizează reclama singur." },
      { q: "Cât costă reclamele?", a: "Bugetul de reclame îl alegi tu (ex. 30–100 lei/zi) și e plătit direct către Facebook. AdPilot e gratuit 3 zile ca să testezi, apoi de la un plan lunar." },
      { q: "Pe ce apar reclamele?", a: "Pe Facebook și Instagram — exact unde sunt clientele tale, targetate pe orașul și zona ta." },
      { q: "Cum primesc programările?", a: "Fiecare persoană interesată îți vine ca lead direct pe WhatsApp, cu nume și telefon, gata de contactat." },
      { q: "Pot să mă opresc oricând?", a: "Da. Pornești și oprești reclama când vrei, direct din WhatsApp. Fără contracte, fără bătăi de cap." },
    ],
  },
};
