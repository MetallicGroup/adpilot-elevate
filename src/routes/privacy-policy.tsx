import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({ meta: [{ title: "Politica de confidențialitate — AdPilot" }, { name: "description", content: "Cum colectează, folosește, stochează și protejează AdPilot datele tale personale." }] }),
  component: () => (
    <LegalPage title="Politica de confidențialitate" updated="10 iunie 2026">
      <P>Această Politică descrie cum AdPilot SRL („AdPilot", „noi") colectează, folosește, stochează, partajează și protejează datele personale când folosești platforma AdPilot, site-ul și serviciile asociate (împreună, „Serviciile"). Folosind Serviciile, accepți practicile descrise mai jos.</P>

      <H2>1. Cine suntem</H2>
      <P>AdPilot SRL este o companie înregistrată în România. Pentru scopurile legislației europene privind protecția datelor, AdPilot este operatorul de date pentru datele descrise în această Politică. Ne poți contacta la support@adpilot.ro pentru orice întrebare privind confidențialitatea.</P>

      <H2>2. Ce informații colectăm</H2>
      <UL>
        <li><strong>Date de cont</strong> — nume, email, hash parolă, fotografie de profil.</li>
        <li><strong>Date de facturare</strong> — adresă, CUI/CIF, detalii metodă de plată (procesate de Stripe; nu stocăm numere de card).</li>
        <li><strong>Date conturi de reclame</strong> — tokenuri OAuth, ID-uri cont, metadate campanii, metrici de performanță, răspunsuri formulare colectate prin campaniile tale.</li>
        <li><strong>Date de utilizare</strong> — pagini vizitate, funcții folosite, momente, adresă IP, user agent, tip dispozitiv.</li>
        <li><strong>Date de suport</strong> — mesajele trimise prin email, chat sau formulare de contact.</li>
      </UL>

      <H2>3. Cum folosim datele</H2>
      <UL>
        <li><strong>Pentru furnizarea Serviciilor</strong> (contract): cont, conectare cont de reclame, lansare și administrare campanii, livrare clienți, rapoarte.</li>
        <li><strong>Pentru îmbunătățirea Serviciilor</strong> (interes legitim): analiză agregată pentru a remedia bug-uri și a dezvolta funcționalități.</li>
        <li><strong>Pentru comunicare</strong> (contract / interes legitim): emailuri tranzacționale, actualizări produs, alerte de securitate.</li>
        <li><strong>Pentru marketing</strong> (consimțământ): doar dacă ți-ai exprimat acordul.</li>
        <li><strong>Pentru obligații legale</strong>: evidențe fiscale, cereri ale autorităților, prevenirea fraudei.</li>
      </UL>

      <H2>4. Cum partajăm datele</H2>
      <P>Nu vindem și nu închiriem date personale. Le partajăm doar cu următoarele categorii de destinatari, fiecare obligat prin acorduri de confidențialitate și prelucrare a datelor:</P>
      <UL>
        <li>Furnizori de cloud și baze de date pentru operarea platformei.</li>
        <li>Procesatori de plăți (Stripe) pentru facturare.</li>
        <li>Furnizori de email și mesagerie pentru comunicări tranzacționale.</li>
        <li>TikTok pentru Business și Meta, pentru a opera campaniile autorizate de tine.</li>
        <li>Furnizori de analitică (de ex. Google Analytics, cu anonimizarea IP).</li>
        <li>Autorități, când legea o cere.</li>
      </UL>

      <H2>5. Transferuri internaționale</H2>
      <P>Unii furnizori sunt în afara Spațiului Economic European. Pentru transferuri folosim Clauze Contractuale Standard sau decizii de adecvare. Poți cere o copie scriind la support@adpilot.ro.</P>

      <H2>6. Păstrarea datelor</H2>
      <UL>
        <li>Date de cont: pe durata contului plus 24 de luni după ștergere pentru scopuri legale.</li>
        <li>Evidențe de facturare: 10 ani, conform legislației fiscale române.</li>
        <li>Clienții colectați: pe durata contului sau până îi ștergi tu.</li>
        <li>Corespondență de suport: 24 de luni de la ultima interacțiune.</li>
      </UL>

      <H2>7. Drepturile tale</H2>
      <P>Conform GDPR ai dreptul: de acces; de rectificare; de ștergere; de restricționare; de opoziție; de portabilitate; de a retrage consimțământul. Poți depune și o plângere la ANSPDCP. Scrie-ne la support@adpilot.ro și răspundem în maximum 30 de zile.</P>

      <H2>8. Securitate</H2>
      <P>Implementăm măsuri de securitate standard: TLS în tranzit, criptare AES-256 în repaus, controale de acces bazate pe roluri, jurnalizare, backupuri automate. Te încurajăm să folosești o parolă puternică și autentificare în doi pași.</P>

      <H2>9. Minori</H2>
      <P>AdPilot nu se adresează copiilor sub 16 ani și nu colectăm intenționat date despre ei. Dacă crezi că un copil ne-a furnizat date, scrie-ne la support@adpilot.ro și le vom șterge.</P>

      <H2>10. Cookies</H2>
      <P>Folosim cookies așa cum este descris în Politica de cookies. Îți poți gestiona preferințele din bannerul afișat la prima vizită.</P>

      <H2>11. Modificări</H2>
      <P>Putem actualiza această Politică din când în când. Modificările importante sunt comunicate prin email și/sau banner în aplicație cu cel puțin 14 zile înainte. Data „Ultima actualizare" reflectă cea mai recentă revizie.</P>

      <H2>12. Contact</H2>
      <P>Pentru orice întrebare, contactează-ne: AdPilot SRL, support@adpilot.ro, România.</P>
    </LegalPage>
  ),
});
