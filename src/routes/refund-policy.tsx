import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";
import { CompanyDetails } from "@/components/marketing/CompanyDetails";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Politica de rambursare — AdPilot" },
      { name: "description", content: "Politica de rambursare și anulare a abonamentului AdPilot." },
      { property: "og:title", content: "Politica de rambursare — AdPilot" },
      { property: "og:description", content: "Politica de rambursare și anulare a abonamentului AdPilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://adpilot.ro/refund-policy" },
    ],
    links: [{ rel: "canonical", href: "https://adpilot.ro/refund-policy" }],
  }),
  component: () => (
    <LegalPage title="Politica de rambursare" updated="3 august 2026">
      <CompanyDetails />
      <P>
        Politica de rambursare de mai jos se aplică tuturor abonamentelor plătite în platforma AdPilot. Dacă ai întrebări, ne poți scrie oricând la{" "}
        <a href="mailto:support@adpilot.ro" className="underline underline-offset-4 hover:text-foreground">
          support@adpilot.ro
        </a>
        .
      </P>

      <H2>Previzualizare gratuită</H2>
      <P>Contul creat cu numărul de WhatsApp primește gratuit previzualizarea primului clip, cu primele secunde vizibile. Clipul întreg și pozele se deblochează prin alegerea unui pachet. Conturile create înainte de această schimbare își păstrează condițiile avute la înscriere.</P>

      <H2>Rambursări</H2>
      <P>Odată ce a fost generat un clip sau o poză pentru tine, plata nu se mai rambursează. Clipul deblocat la plată e deja generat, așa că plata care îl deblochează nu se rambursează. La fel și plățile de trecere pe un pachet mai mare, precum și reînnoirile din perioadele în care ai generat ceva.</P>
      <P>La plată îți dai acordul să primești conținutul digital imediat și renunți la dreptul de retragere de 14 zile.</P>
      <P>Dacă nu s-a generat nimic din pachetul tău, poți solicita o rambursare completă în primele 7 zile de la prima plată. Un clip care nu poate fi generat nu consumă din pachet.</P>

      <H2>Cum soliciți rambursarea</H2>
      <P>Trimite un email la support@adpilot.ro cu subiectul „Rambursare", menționând adresa de email asociată contului tău AdPilot. Rambursările aprobate sunt procesate în 3-5 zile lucrătoare în contul din care s-a efectuat plata inițială.</P>

      <H2>Ce nu se rambursează</H2>
      <UL>
        <li>Plățile pentru care a fost generat cel puțin un clip sau o poză.</li>
        <li>Lunile de abonament deja consumate după primele 7 zile de la prima plată.</li>
        <li>Bugetul de reclame cheltuit direct pe Facebook, Instagram sau TikTok — aceste sume sunt plătite direct către platformă și nu trec prin AdPilot.</li>
      </UL>

      <H2>Anulare abonament</H2>
      <P>Poți anula abonamentul oricând din contul tău, fără penalități. Accesul la platformă rămâne activ până la sfârșitul perioadei plătite, după care contul trece în plan gratuit sau este suspendat.</P>

      <H2>Contact</H2>
      <P>
        Pentru solicitări de rambursare sau clarificări, scrie-ne la{" "}
        <a href="mailto:support@adpilot.ro" className="underline underline-offset-4 hover:text-foreground">
          support@adpilot.ro
        </a>
        .
      </P>
    </LegalPage>
  ),
});
