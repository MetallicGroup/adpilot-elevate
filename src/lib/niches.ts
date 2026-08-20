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

  dentist: {
    slug: "dentist",
    contentId: "oferta-dentist",
    meta: {
      title: "Mai mulți pacienți la clinica ta — AdPilot",
      description:
        "AdPilot aduce pacienți noi la clinica ta stomatologică sau de estetică — reclame Facebook și Instagram automate, cu fiecare pacient interesat direct pe WhatsApp. Începe gratuit.",
    },
    hero: {
      badge: "Pentru clinici stomatologice · estetică · medicale",
      titlePre: "Mai mulți ",
      titleHighlight: "pacienți noi",
      titlePost: ". Lunar.",
      subtitle:
        "Reclame Facebook și Instagram gestionate cu AI. Fiecare pacient interesat vine direct pe WhatsApp — fără agenție, fără bătăi de cap.",
      ctaLabel: "Vreau mai mulți pacienți",
    },
    socialProof: "Alătură-te clinicilor din România care aduc pacienți noi cu AdPilot 🇷🇴",
    problem: {
      title: "Ești medic sau ai o clinică și…",
      items: [
        "Pacienții noi vin din ce în ce mai greu și mai scump.",
        "Depinzi de recomandări, dar vrei un flux constant și previzibil.",
        "N-ai timp să te ocupi de marketing și nici să plătești o agenție scumpă.",
      ],
    },
    demo: {
      title: "Așa aduci pacienți noi — dintr-o conversație pe WhatsApp",
      lines: [
        { from: "me", text: "Vreau mai mulți pacienți la clinică" },
        { from: "bot", text: "Perfect! Pornesc o reclamă pe Facebook și Instagram. Ce serviciu vrei să promovezi?" },
        { from: "me", text: "Implant dentar, buget 150 lei/zi" },
        { from: "bot", text: "Gata, reclama e live! 🎉 Îți trimit aici fiecare pacient interesat." },
        { from: "bot", text: "📩 Pacient nou: Mihai, 0733… — vrea o consultație pentru implant" },
      ],
    },
    steps: [
      { title: "Conectezi Facebook", desc: "Legi pagina clinicii în câteva secunde." },
      { title: "Spui ce promovezi", desc: "„Implant”, „albire”, „consultație gratuită” — în română." },
      { title: "Primești pacienți", desc: "Fiecare pacient interesat îți vine direct pe WhatsApp." },
    ],
    faq: [
      { q: "E permis să faci reclame la servicii medicale?", a: "Da, cu mesaje corecte. AdPilot construiește reclame conforme cu regulile Meta pentru domeniul medical." },
      { q: "Cât costă reclamele?", a: "Bugetul îl alegi tu (ex. 100–300 lei/zi) și e plătit direct către Facebook. AdPilot e gratuit 3 zile, apoi de la un plan lunar." },
      { q: "Cum primesc pacienții?", a: "Fiecare persoană interesată îți vine ca lead pe WhatsApp, cu nume și telefon, gata de programat." },
      { q: "Funcționează pentru orice specialitate?", a: "Da — stomatologie, estetică, dermatologie, clinici generale. Targetăm exact zona și publicul tău." },
      { q: "Pot opri oricând?", a: "Da, pornești și oprești reclama din WhatsApp, fără contracte." },
    ],
  },

  fitness: {
    slug: "fitness",
    contentId: "oferta-fitness",
    meta: {
      title: "Sala ta plină tot anul — AdPilot",
      description:
        "AdPilot aduce membri noi la sala ta constant, nu doar în ianuarie — reclame Facebook și Instagram automate, cu fiecare lead direct pe WhatsApp. Începe gratuit.",
    },
    hero: {
      badge: "Pentru săli de sport · personal traineri · fitness",
      titlePre: "Sala ta ",
      titleHighlight: "plină tot anul",
      titlePost: ". Nu doar în ianuarie.",
      subtitle:
        "Reclame automate care aduc membri noi constant — direct pe WhatsApp-ul tău. Fără agenție, fără experiență.",
      ctaLabel: "Vreau mai mulți membri",
    },
    socialProof: "Alătură-te sălilor și trainerilor din România care cresc cu AdPilot 🇷🇴",
    problem: {
      title: "Ai o sală sau ești personal trainer și…",
      items: [
        "Ai valuri: plin în ianuarie și septembrie, gol în rest.",
        "Postezi pe Instagram, dar nu se transformă în membri plătitori.",
        "Vrei un flux constant de clienți noi, fără să devii marketer.",
      ],
    },
    demo: {
      title: "Așa aduci membri noi — dintr-o conversație pe WhatsApp",
      lines: [
        { from: "me", text: "Vreau mai mulți membri la sală" },
        { from: "bot", text: "Perfect! Pornesc o reclamă pe Facebook și Instagram. Ce oferi — abonament, clase, personal training?" },
        { from: "me", text: "Abonament lunar, buget 70 lei/zi" },
        { from: "bot", text: "Gata, reclama e live! 🎉 Îți trimit aici fiecare persoană interesată." },
        { from: "bot", text: "📩 Lead nou: Alex, 0744… — vrea un abonament lunar cu acces la sală" },
      ],
    },
    steps: [
      { title: "Conectezi Facebook", desc: "Legi pagina sălii în câteva secunde." },
      { title: "Spui ce oferi", desc: "„Abonament”, „clase de grup”, „personal training” — în română." },
      { title: "Primești membri", desc: "Fiecare persoană interesată îți vine direct pe WhatsApp." },
    ],
    faq: [
      { q: "Trebuie să știu ceva despre reclame?", a: "Nu. Îi spui pe WhatsApp ce oferi, iar AdPilot creează, lansează și optimizează reclama singur." },
      { q: "Cât costă reclamele?", a: "Bugetul îl alegi tu (ex. 50–150 lei/zi) și e plătit direct către Facebook. AdPilot e gratuit 3 zile, apoi de la un plan lunar." },
      { q: "Funcționează și pentru personal traineri?", a: "Da — pentru săli, studiouri și traineri individuali. Targetăm exact orașul și publicul tău." },
      { q: "Cum primesc clienții?", a: "Fiecare persoană interesată îți vine ca lead pe WhatsApp, cu nume și telefon." },
      { q: "Pot opri oricând?", a: "Da, pornești și oprești reclama din WhatsApp, fără contracte." },
    ],
  },
};
