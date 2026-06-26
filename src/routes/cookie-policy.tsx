import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/cookie-policy")({
  head: () => ({ meta: [{ title: "Politica de cookies — AdPilot" }, { name: "description", content: "Cum folosește AdPilot cookies și tehnologii similare." }] }),
  component: () => (
    <LegalPage title="Politica de cookies" updated="10 iunie 2026">
      <P>Această Politică explică cum AdPilot SRL folosește cookies și tehnologii similare atunci când vizitezi site-ul sau folosești platforma AdPilot. Citește-o împreună cu Politica noastră de confidențialitate.</P>

      <H2>1. Ce este un cookie?</H2>
      <P>Un cookie este un fișier text mic stocat pe dispozitivul tău de către browser. Cookies permit site-urilor să rețină acțiunile și preferințele tale (limba, autentificare, setări) astfel încât să nu le introduci de fiecare dată.</P>

      <H2>2. Categorii de cookies</H2>
      <UL>
        <li><strong>Strict necesare</strong> — pentru funcționarea site-ului (autentificare, securitate). Nu pot fi dezactivate.</li>
        <li><strong>Funcționale</strong> — rețin preferințele tale (limbă, temă, bannere închise).</li>
        <li><strong>Analitică</strong> — ne ajută să înțelegem cum este folosit site-ul (de ex. Google Analytics cu IP anonimizat).</li>
        <li><strong>Marketing</strong> — folosite de noi și parteneri (Meta Pixel) pentru a măsura eficacitatea campaniilor. Doar cu consimțământul tău.</li>
      </UL>

      <H2>3. Cum îți administrezi preferințele</H2>
      <P>Poți accepta sau refuza cookies-urile non-esențiale din bannerul afișat la prima vizită. Le poți modifica oricând din linkul „Preferințe cookies" din subsol. Le poți bloca și din setările browserului — blocarea cookies-urilor strict necesare poate împiedica funcționarea corectă a platformei.</P>

      <H2>4. Cookies de la terți</H2>
      <P>Unele cookies sunt setate de terți (Stripe pentru plăți, Google pentru analitică și Meta pentru măsurarea reclamelor). Aceștia au propriile politici, te încurajăm să le citești.</P>

      <H2>5. Modificări</H2>
      <P>Putem actualiza această politică din când în când. Data „Ultima actualizare" de sus reflectă cea mai recentă revizie. Pentru întrebări, scrie-ne la support@adpilot.ro.</P>
    </LegalPage>
  ),
});
