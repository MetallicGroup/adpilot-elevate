import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/gdpr")({
  head: () => ({ meta: [{ title: "Conformitate GDPR — AdPilot" }, { name: "description", content: "Cum respectă AdPilot Regulamentul General privind Protecția Datelor." }] }),
  component: () => (
    <LegalPage title="Conformitate GDPR" updated="10 iunie 2026">
      <P>AdPilot SRL este o companie din UE, complet angajată să respecte Regulamentul General privind Protecția Datelor (Regulamentul (UE) 2016/679, „GDPR"). Această pagină rezumă cum aplicăm principiile GDPR. Pentru detalii complete, citește Politica de confidențialitate.</P>

      <H2>1. Baze legale de prelucrare</H2>
      <P>Prelucrăm datele personale doar atunci când se aplică una dintre bazele legale GDPR — cel mai frecvent: executarea unui contract, consimțământul tău, interesele noastre legitime (echilibrate cu drepturile tale) sau obligația legală.</P>

      <H2>2. Responsabil cu protecția datelor</H2>
      <P>Deși nu suntem strict obligați conform Art. 37, am desemnat un responsabil pe care îl poți contacta la support@adpilot.ro pentru orice chestiune privind datele tale.</P>

      <H2>3. Drepturile tale GDPR</H2>
      <UL>
        <li><strong>Dreptul de acces</strong> — să primești o copie a datelor pe care le deținem despre tine.</li>
        <li><strong>Dreptul la rectificare</strong> — să corectezi date inexacte sau incomplete.</li>
        <li><strong>Dreptul la ștergere</strong> — să ceri ștergerea datelor tale, sub rezerva obligațiilor legale de păstrare.</li>
        <li><strong>Dreptul la restricționare</strong> — să limitezi modul în care îți folosim datele.</li>
        <li><strong>Dreptul la portabilitate</strong> — să primești datele într-un format structurat, uzual.</li>
        <li><strong>Dreptul la opoziție</strong> — față de prelucrarea bazată pe interese legitime sau marketing direct.</li>
        <li><strong>Dreptul de a retrage consimțământul</strong> — oricând, fără a afecta prelucrarea anterioară.</li>
        <li><strong>Dreptul de a depune o plângere</strong> — la ANSPDCP sau la autoritatea locală de supraveghere.</li>
      </UL>
      <P>Pentru a exercita orice drept, scrie-ne la support@adpilot.ro. Răspundem în maximum 30 de zile.</P>

      <H2>4. Acord de prelucrare a datelor (DPA)</H2>
      <P>Atunci când AdPilot acționează ca persoană împuternicită pentru tine (de ex. prelucrarea clienților colectați prin campaniile tale), oferim un Acord de Prelucrare a Datelor care include clauzele cerute de GDPR. Pentru o copie, scrie la support@adpilot.ro.</P>

      <H2>5. Transferuri internaționale de date</H2>
      <P>Acolo unde datele personale sunt transferate în afara Spațiului Economic European, ne bazăm pe decizii de adecvare ale Comisiei Europene sau pe Clauze Contractuale Standard (SCCs), cu măsuri suplimentare unde e cazul.</P>

      <H2>6. Subprocesatori</H2>
      <P>Menținem o listă de subprocesatori folosiți pentru operarea Serviciilor, disponibilă la cerere. Notificăm clienții cu cel puțin 14 zile înainte de adăugarea unui nou subprocesator.</P>

      <H2>7. Notificarea breșelor</H2>
      <P>În cazul puțin probabil al unei breșe de securitate care prezintă risc pentru drepturile persoanelor, AdPilot notifică autoritatea de supraveghere în 72 de ore și, când este necesar, informează persoanele afectate fără întârziere.</P>

      <H2>8. Contact</H2>
      <P>Pentru orice întrebare GDPR, scrie la support@adpilot.ro sau către AdPilot SRL, România.</P>
    </LegalPage>
  ),
});
