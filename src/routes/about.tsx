import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Band, FinalCta } from "@/components/v2/kit";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "Despre — AdPilot" },
    { name: "description", content: "AdPilot face publicitatea pe Facebook și Instagram accesibilă oricărei afaceri — fără agenție." },
    { property: "og:title", content: "Despre AdPilot" },
    { property: "og:description", content: "Misiunea noastră: reclame Facebook și Instagram accesibile oricărei afaceri." },
    { property: "og:url", content: "https://adpilot.ro/about" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/about" }] }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Despre noi" title="Reclame online accesibile oricărei afaceri." subtitle="Am construit AdPilot pentru că orice afacere mică merită aceeași putere de publicitate ca brandurile mari — fără costurile unei agenții." />
      <Band tone="light">
        <article className="legal">
          <p>AdPilot a fost fondat în 2025 de o echipă de marketeri, ingineri și cercetători AI care au construit ani la rând campanii de performanță pentru branduri direct-to-consumer. Vedeam mereu aceeași poveste: un produs bun, un buget mic, și o platformă de reclame atât de complexă încât avea nevoie de un specialist full-time doar pentru a lansa o singură campanie.</p>
          <p>Meta (Facebook și Instagram) este cea mai puternică platformă de achiziție de clienți a deceniului — și merită un instrument care vine la nivelul oamenilor. AdPilot înlocuiește agenția cu un co-pilot AI care construiește, lansează și optimizează campanii în câteva minute, nu săptămâni.</p>
          <p>Astăzi, AdPilot ajută afaceri de servicii, magazine online și antreprenori locali din toată Europa. Avem sediul în București, România, cu o echipă fully remote în toată UE.</p>
        </article>
        <div className="trio">
          <div data-r>
            <span className="k">FONDAT</span>
            <h3>2025</h3>
          </div>
          <div data-r>
            <span className="k">SEDIU</span>
            <h3>București, RO</h3>
          </div>
          <div data-r>
            <span className="k">ECHIPĂ</span>
            <h3>Fully remote</h3>
          </div>
        </div>
      </Band>
      <FinalCta title={<>Prima reclamă,<br />în 5 minute.</>} />
    </MarketingLayout>
  );
}
