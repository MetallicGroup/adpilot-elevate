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

  restaurant: {
    slug: "restaurant",
    contentId: "oferta-restaurant",
    meta: {
      title: "Restaurant plin în fiecare weekend — AdPilot",
      description:
        "AdPilot aduce rezervări și clienți noi la restaurantul tău — reclame locale Facebook și Instagram automate, cu fiecare persoană interesată direct pe WhatsApp. Începe gratuit.",
    },
    hero: {
      badge: "Pentru restaurante · cafenele · baruri",
      titlePre: "Restaurant ",
      titleHighlight: "plin în fiecare weekend",
      titlePost: ".",
      subtitle:
        "Reclame locale automate care aduc rezervări și clienți noi — direct pe WhatsApp. Fără agenție, fără experiență.",
      ctaLabel: "Vreau mai multe rezervări",
    },
    socialProof: "Alătură-te restaurantelor din România care se umplu cu AdPilot 🇷🇴",
    problem: {
      title: "Ai un restaurant sau o cafenea și…",
      items: [
        "Ai seri și weekenduri cu mese goale.",
        "Postezi pe Instagram, dar nu se transformă în rezervări.",
        "N-ai timp de marketing și nici buget de agenție.",
      ],
    },
    demo: {
      title: "Așa umpli mesele — dintr-o conversație pe WhatsApp",
      lines: [
        { from: "me", text: "Vreau mai multe rezervări la restaurant" },
        { from: "bot", text: "Perfect! Pornesc o reclamă locală pe Facebook și Instagram. Ce vrei să promovezi — meniul, o ofertă, weekendul?" },
        { from: "me", text: "Ofertă de weekend, buget 60 lei/zi" },
        { from: "bot", text: "Gata, reclama e live! 🎉 Îți trimit aici fiecare persoană interesată." },
        { from: "bot", text: "📩 Client nou: Ioana, 0755… — vrea o rezervare pentru 4 persoane sâmbătă seara" },
      ],
    },
    steps: [
      { title: "Conectezi Facebook", desc: "Legi pagina localului în câteva secunde." },
      { title: "Spui ce promovezi", desc: "Meniul, o ofertă sau weekendul — în română." },
      { title: "Primești rezervări", desc: "Fiecare persoană interesată îți vine direct pe WhatsApp." },
    ],
    faq: [
      { q: "Reclamele apar în zona mea?", a: "Da. Targetăm exact orașul și zona din jurul localului tău, ca să vină clienți care chiar pot ajunge." },
      { q: "Cât costă reclamele?", a: "Bugetul îl alegi tu (ex. 40–100 lei/zi) și e plătit direct către Facebook. AdPilot e gratuit 3 zile, apoi de la un plan lunar." },
      { q: "Cum primesc rezervările?", a: "Fiecare persoană interesată îți vine ca lead pe WhatsApp, cu nume și telefon." },
      { q: "Funcționează și pentru cafenele sau baruri?", a: "Da — pentru orice local. Adaptăm mesajul la ce oferi tu." },
      { q: "Pot opri oricând?", a: "Da, pornești și oprești reclama din WhatsApp, fără contracte." },
    ],
  },

  imobiliare: {
    slug: "imobiliare",
    contentId: "oferta-imobiliare",
    meta: {
      title: "Mai mulți clienți calificați pentru imobiliare — AdPilot",
      description:
        "AdPilot generează lead-uri calificate pentru proprietățile tale și le livrează instant pe WhatsApp — reclame Facebook și Instagram automate. Începe gratuit.",
    },
    hero: {
      badge: "Pentru agenți și agenții imobiliare",
      titlePre: "Mai mulți ",
      titleHighlight: "clienți calificați",
      titlePost: ". Mai puține ore pierdute.",
      subtitle:
        "AdPilot generează lead-uri calificate pentru proprietățile tale și le livrează instant pe WhatsApp. Fără agenție, fără experiență.",
      ctaLabel: "Vreau lead-uri calificate",
    },
    socialProof: "Alătură-te agenților din România care aduc clienți cu AdPilot 🇷🇴",
    problem: {
      title: "Ești agent imobiliar și…",
      items: [
        "Pierzi ore cu lead-uri care nu cumpără niciodată.",
        "Depinzi de portaluri scumpe și de recomandări.",
        "Vrei un flux constant de clienți serioși, fără să devii marketer.",
      ],
    },
    demo: {
      title: "Așa aduci clienți — dintr-o conversație pe WhatsApp",
      lines: [
        { from: "me", text: "Vreau clienți pentru un apartament de vânzare" },
        { from: "bot", text: "Perfect! Pornesc o reclamă pe Facebook și Instagram. Ce proprietate promovezi?" },
        { from: "me", text: "Apartament 3 camere, 85.000 €, buget 80 lei/zi" },
        { from: "bot", text: "Gata, reclama e live! 🎉 Îți trimit aici fiecare persoană interesată." },
        { from: "bot", text: "📩 Lead nou: Radu, 0766… — vrea o vizionare pentru apartamentul cu 3 camere" },
      ],
    },
    steps: [
      { title: "Conectezi Facebook", desc: "Legi pagina de agent în câteva secunde." },
      { title: "Adaugi proprietatea", desc: "Îi spui ce vinzi sau închiriezi — în română." },
      { title: "Primești clienți", desc: "Fiecare persoană interesată îți vine direct pe WhatsApp." },
    ],
    faq: [
      { q: "Lead-urile sunt calificate?", a: "Da. Targetăm oameni cu intenție reală pentru zona și tipul proprietății, ca să pierzi mai puțin timp." },
      { q: "Cât costă reclamele?", a: "Bugetul îl alegi tu (ex. 50–150 lei/zi) și e plătit direct către Facebook. AdPilot e gratuit 3 zile, apoi de la un plan lunar." },
      { q: "Funcționează pentru vânzare și închiriere?", a: "Da — pentru orice tip de proprietate, rezidențial sau comercial." },
      { q: "Cum primesc clienții?", a: "Fiecare persoană interesată îți vine ca lead pe WhatsApp, cu nume și telefon." },
      { q: "Pot opri oricând?", a: "Da, pornești și oprești reclama din WhatsApp, fără contracte." },
    ],
  },

  cursuri: {
    slug: "cursuri",
    contentId: "oferta-cursuri",
    meta: {
      title: "Mai mulți cursanți la cursurile tale — AdPilot",
      description:
        "AdPilot aduce înscrieri la cursurile și programele tale — reclame Facebook și Instagram automate, cu fiecare persoană interesată direct pe WhatsApp. Începe gratuit.",
    },
    hero: {
      badge: "Pentru cursuri online · coaching · training",
      titlePre: "Mai mulți ",
      titleHighlight: "cursanți înscriși",
      titlePost: ".",
      subtitle:
        "Reclame automate care aduc înscrieri la cursurile și programele tale — direct pe WhatsApp. Fără agenție, fără experiență.",
      ctaLabel: "Vreau mai mulți cursanți",
    },
    socialProof: "Alătură-te trainerilor din România care își umplu grupele cu AdPilot 🇷🇴",
    problem: {
      title: "Ai un curs sau un program de coaching și…",
      items: [
        "Ai grupe care nu se umplu la timp.",
        "Postezi conținut, dar nu se transformă în înscrieri.",
        "Vrei un flux constant de cursanți, fără să devii marketer.",
      ],
    },
    demo: {
      title: "Așa aduci înscrieri — dintr-o conversație pe WhatsApp",
      lines: [
        { from: "me", text: "Vreau înscrieri la cursul meu online" },
        { from: "bot", text: "Perfect! Pornesc o reclamă pe Facebook și Instagram. Ce curs promovezi?" },
        { from: "me", text: "Curs de engleză online, buget 50 lei/zi" },
        { from: "bot", text: "Gata, reclama e live! 🎉 Îți trimit aici fiecare persoană interesată." },
        { from: "bot", text: "📩 Lead nou: Elena, 0777… — vrea detalii despre cursul de engleză" },
      ],
    },
    steps: [
      { title: "Conectezi Facebook", desc: "Legi pagina în câteva secunde." },
      { title: "Spui ce curs oferi", desc: "Subiectul, prețul, data de start — în română." },
      { title: "Primești înscrieri", desc: "Fiecare persoană interesată îți vine direct pe WhatsApp." },
    ],
    faq: [
      { q: "Trebuie să știu ceva despre reclame?", a: "Nu. Îi spui pe WhatsApp ce curs oferi, iar AdPilot creează, lansează și optimizează reclama singur." },
      { q: "Cât costă reclamele?", a: "Bugetul îl alegi tu (ex. 40–120 lei/zi) și e plătit direct către Facebook. AdPilot e gratuit 3 zile, apoi de la un plan lunar." },
      { q: "Funcționează pentru orice tip de curs?", a: "Da — cursuri online, ateliere, coaching, mentorat. Targetăm exact publicul potrivit." },
      { q: "Cum primesc înscrierile?", a: "Fiecare persoană interesată îți vine ca lead pe WhatsApp, cu nume și telefon." },
      { q: "Pot opri oricând?", a: "Da, pornești și oprești reclama din WhatsApp, fără contracte." },
    ],
  },

  "service-auto": {
    slug: "service-auto",
    contentId: "oferta-service-auto",
    meta: {
      title: "Mai multe mașini în service — AdPilot",
      description:
        "AdPilot aduce clienți noi la service-ul tău auto — reclame locale Facebook și Instagram automate, cu fiecare persoană interesată direct pe WhatsApp. Începe gratuit.",
    },
    hero: {
      badge: "Pentru service-uri auto · vulcanizări · detailing",
      titlePre: "Mai multe ",
      titleHighlight: "mașini în service",
      titlePost: ". Constant.",
      subtitle:
        "Reclame locale care aduc clienți noi la service-ul tău — direct pe WhatsApp. Fără agenție, fără experiență.",
      ctaLabel: "Vreau mai mulți clienți",
    },
    socialProof: "Alătură-te service-urilor din România care aduc clienți cu AdPilot 🇷🇴",
    problem: {
      title: "Ai un service auto și…",
      items: [
        "Ai zile cu rampe goale și mecanici fără treabă.",
        "Depinzi doar de clienții din zonă și de recomandări.",
        "N-ai timp de marketing și nici buget de agenție.",
      ],
    },
    demo: {
      title: "Așa aduci clienți — dintr-o conversație pe WhatsApp",
      lines: [
        { from: "me", text: "Vreau mai mulți clienți la service" },
        { from: "bot", text: "Perfect! Pornesc o reclamă locală pe Facebook și Instagram. Ce servicii promovezi?" },
        { from: "me", text: "Schimb ulei și ITP, buget 50 lei/zi" },
        { from: "bot", text: "Gata, reclama e live! 🎉 Îți trimit aici fiecare persoană interesată." },
        { from: "bot", text: "📩 Client nou: George, 0788… — vrea o programare pentru schimb de ulei" },
      ],
    },
    steps: [
      { title: "Conectezi Facebook", desc: "Legi pagina service-ului în câteva secunde." },
      { title: "Spui ce servicii oferi", desc: "Schimb ulei, ITP, detailing — în română." },
      { title: "Primești clienți", desc: "Fiecare persoană interesată îți vine direct pe WhatsApp." },
    ],
    faq: [
      { q: "Reclamele apar în zona mea?", a: "Da. Targetăm exact orașul și zona din jurul service-ului, ca să vină clienți care pot ajunge la tine." },
      { q: "Cât costă reclamele?", a: "Bugetul îl alegi tu (ex. 40–100 lei/zi) și e plătit direct către Facebook. AdPilot e gratuit 3 zile, apoi de la un plan lunar." },
      { q: "Funcționează pentru vulcanizări sau detailing?", a: "Da — pentru orice service auto. Adaptăm mesajul la serviciile tale." },
      { q: "Cum primesc clienții?", a: "Fiecare persoană interesată îți vine ca lead pe WhatsApp, cu nume și telefon." },
      { q: "Pot opri oricând?", a: "Da, pornești și oprești reclama din WhatsApp, fără contracte." },
    ],
  },
};
