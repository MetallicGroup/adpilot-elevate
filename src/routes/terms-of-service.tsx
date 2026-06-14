import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({ meta: [{ title: "Termeni și condiții — AdPilot" }, { name: "description", content: "Termenii care guvernează folosirea platformei AdPilot." }] }),
  component: () => (
    <LegalPage title="Termeni și condiții" updated="10 iunie 2026">
      <P>Acești Termeni formează un acord obligatoriu între tine („Client") și AdPilot SRL („AdPilot", „noi") și guvernează accesul și folosirea platformei AdPilot, a site-ului și a serviciilor asociate („Serviciile"). Creând un cont sau folosind Serviciile, accepți acești Termeni.</P>

      <H2>1. Serviciile</H2>
      <P>AdPilot oferă o platformă SaaS care ajută afacerile să creeze, administreze, optimizeze și raporteze campanii de publicitate pe Meta (Facebook și Instagram). Serviciile includ instrumente de creare campanii, generare de creativ cu AI, livrare de clienți potențiali, dashboarduri de analitică și un asistent conversațional pe WhatsApp.</P>

      <H2>2. Înregistrarea contului</H2>
      <P>Pentru a folosi Serviciile trebuie să îți creezi un cont. Te angajezi să furnizezi informații exacte, complete și actuale, să păstrezi parola confidențială și să ne notifici imediat orice acces neautorizat. Ești responsabil pentru toate activitățile din contul tău. Trebuie să ai cel puțin 18 ani și să fii autorizat să angajezi afacerea pentru care te înregistrezi.</P>

      <H2>3. Conectarea conturilor de reclame</H2>
      <P>Pentru a opera campanii, trebuie să conectezi contul tău de reclame Meta la AdPilot prin fluxul OAuth oficial. Confirmi că ai dreptul și autoritatea de a acorda AdPilot acces la aceste conturi. Conturile rămân mereu ale tale — AdPilot acționează doar la instrucțiunile tale și în limita permisiunilor acordate.</P>

      <H2>4. Folosire acceptabilă</H2>
      <P>Te angajezi să nu folosești Serviciile pentru:</P>
      <UL>
        <li>A încălca legi sau reglementări, inclusiv legile privind publicitatea.</li>
        <li>A rula campanii care promovează produse ilegale, discurs de ură, hărțuire, dezinformare sau material sexual explicit.</li>
        <li>A încălca proprietatea intelectuală, dreptul la confidențialitate sau la imagine al unui terț.</li>
        <li>A face inginerie inversă, decompila sau extrage codul-sursă al Serviciilor.</li>
        <li>A sonda sau testa vulnerabilitățile Serviciilor fără acordul nostru scris.</li>
        <li>A trimite spam, malware sau cod dăunător.</li>
        <li>A revinde sau sublicenția Serviciile fără acordul nostru scris.</li>
      </UL>
      <P>Trebuie să respecți și politicile de publicitate ale Meta.</P>

      <H2>5. Abonamente, facturare și perioadă de probă</H2>
      <P>AdPilot este oferit ca abonament lunar plătit. Clienții noi pot beneficia de 14 zile gratuite. După această perioadă, abonamentele se reînnoiesc automat lunar la prețul curent până la anulare. Poți anula oricând din contul tău; anularea intră în vigoare la finalul perioadei plătite. Taxele nu sunt rambursabile decât unde legea o cere. Putem modifica prețurile cu notificare de cel puțin 30 de zile; modificările se aplică doar la reînnoire.</P>
      <P>Abonamentul acoperă doar accesul la platformă. Bugetul de reclame este facturat direct de Meta și nu este inclus.</P>

      <H2>6. Conținutul și datele Clientului</H2>
      <P>Păstrezi toate drepturile asupra conținutului, creativelor, textelor și brandului încărcate sau generate prin Servicii („Date Client"). Acorzi AdPilot o licență limitată, internațională, non-exclusivă pentru a găzdui, prelucra, transmite și afișa Datele Client doar pentru furnizarea și îmbunătățirea Serviciilor. Răspunzi pentru deținerea drepturilor și acordurilor necesare.</P>

      <H2>7. Conținut generat cu AI</H2>
      <P>Serviciile folosesc furnizori AI terți pentru sugestii de audiență, text și structură de campanie. Rezultatele AI pot fi inexacte sau nepotrivite. Răspunzi pentru revizuirea conținutului generat cu AI înainte de publicare. Nu garantăm originalitatea sau adecvarea conținutului AI pentru un scop anume.</P>

      <H2>8. Confidențialitate</H2>
      <P>Fiecare parte tratează informațiile non-publice ale celeilalte ca fiind confidențiale și le folosește doar pentru scopurile acestor Termeni. Această obligație continuă 3 ani după încetare.</P>

      <H2>9. Proprietate intelectuală</H2>
      <P>AdPilot, logo-ul, codul, documentația și proprietatea intelectuală asociată aparțin AdPilot SRL. Nu îți acordăm alte drepturi decât folosirea limitată a Serviciilor.</P>

      <H2>10. Limitarea garanțiilor</H2>
      <P>Serviciile sunt oferite „așa cum sunt". În măsura permisă de lege, AdPilot nu oferă garanții, exprese sau implicite, inclusiv de calitate comercială sau adecvare pentru un scop. Nu garantăm rezultate specifice de publicitate, ROAS, volum de clienți sau venit.</P>

      <H2>11. Limitarea răspunderii</H2>
      <P>În măsura permisă de lege, răspunderea totală a AdPilot rezultată din acești Termeni nu depășește taxele plătite în ultimele 12 luni. În nicio situație AdPilot nu răspunde pentru daune indirecte, incidentale, consecvențiale, speciale, exemplare sau punitive, inclusiv profituri pierdute sau pierdere de date.</P>

      <H2>12. Despăgubire</H2>
      <P>Te angajezi să despăgubești AdPilot pentru orice pretenție, daună sau cheltuială (inclusiv onorarii avocațiale) rezultată din folosirea Serviciilor cu încălcarea acestor Termeni sau a drepturilor unui terț.</P>

      <H2>13. Încetare</H2>
      <P>Poți închide contul oricând. Putem suspenda sau închide contul dacă încalci Termenii, nu plătești sau desfășori activități frauduloase. La încetare, dreptul tău de a folosi Serviciile se oprește imediat. Clauzele care prin natura lor supraviețuiesc rămân valabile.</P>

      <H2>14. Lege aplicabilă</H2>
      <P>Acești Termeni sunt guvernați de legea română. Orice dispută este de competența exclusivă a instanțelor din București.</P>

      <H2>15. Modificări</H2>
      <P>Putem actualiza acești Termeni. Modificările importante sunt comunicate cu cel puțin 30 de zile înainte prin email și/sau notificare în aplicație. Folosirea continuă a Serviciilor după data efectivă reprezintă acceptul Termenilor revizuiți.</P>

      <H2>16. Contact</H2>
      <P>Întrebări despre acești Termeni? Scrie-ne la support@adpilot.ro sau către AdPilot SRL, România.</P>
    </LegalPage>
  ),
});
