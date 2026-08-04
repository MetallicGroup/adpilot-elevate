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
    ],
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

      <H2>Perioadă de trial gratuită</H2>
      <P>Toți utilizatorii noi beneficiază de 3 zile gratuite la începerea primului abonament. Trialul nu presupune obligații și îl poți anula oricând înainte de expirare.</P>

      <H2>Rambursări după activarea abonamentului</H2>
      <P>Dacă nu ești mulțumit de platformă, poți solicita o rambursare completă în primele 7 zile de la prima plată. După acest interval, taxele de abonament deja plătite nu se mai rambursează.</P>

      <H2>Cum soliciți rambursarea</H2>
      <P>Trimite un email la support@adpilot.ro cu subiectul „Rambursare", menționând adresa de email asociată contului tău AdPilot. Rambursările aprobate sunt procesate în 3-5 zile lucrătoare în contul din care s-a efectuat plata inițială.</P>

      <H2>Ce nu se rambursează</H2>
      <UL>
        <li>Lunile de abonament deja consumate după primele 7 zile de la prima plată.</li>
        <li>Bugetul de reclame cheltuit direct pe Facebook, Instagram sau Google Ads — aceste sume sunt plătite direct către Meta sau Google și nu trec prin AdPilot.</li>
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
