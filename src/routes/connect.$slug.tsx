import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Check, X, ShieldCheck, Facebook } from "lucide-react";
import { getAgencyPublic } from "@/lib/agency.functions";

type ConnectSearch = { done?: string; err?: string };

export const Route = createFileRoute("/connect/$slug")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): ConnectSearch => ({
    done: typeof s.done === "string" ? s.done : undefined,
    err: typeof s.err === "string" ? s.err : undefined,
  }),
  head: () => ({ meta: [{ title: "Conectează-te — AdPilot" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ConnectPage,
});

const ERR: Record<string, string> = {
  denied: "Ai anulat conectarea. Poți încerca din nou.",
  full: "Agenția a atins numărul maxim de clienți. Contactează agenția.",
  noagency: "Linkul de conectare nu este valid.",
  noassets: "Nu am găsit o pagină / cont de reclame pe Facebook-ul tău.",
  bad_state: "Sesiunea a expirat. Încearcă din nou.",
  failed: "Ceva n-a mers. Încearcă din nou.",
};

function ConnectPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const load = useServerFn(getAgencyPublic);
  const [agency, setAgency] = useState<{ name: string; logo_url: string | null; white_label: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    load({ data: { slug } })
      .then((r) => setAgency(r.agency))
      .catch(() => setAgency(null))
      .finally(() => setLoading(false));
  }, [slug]);

  function connect() {
    setConnecting(true);
    window.location.href = `/api/agency/connect/start?slug=${encodeURIComponent(slug)}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agency) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Link invalid</h1>
          <p className="mt-2 text-muted-foreground">Acest link de conectare nu există sau a expirat.</p>
        </div>
      </div>
    );
  }

  const name = agency.name;

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Logo agenție (white-label) sau AdPilot */}
        <div className="flex justify-center mb-8">
          {agency.logo_url ? (
            <img src={agency.logo_url} alt={name} className="h-12 object-contain" />
          ) : (
            <div className="flex items-center gap-2.5 font-bold text-lg">
              <img src="/adpilot-icon.png" alt="AdPilot" className="h-9 w-9 rounded-xl object-contain" />
              AdPilot
            </div>
          )}
        </div>

        {search.done ? (
          <div className="card-floating rounded-2xl border border-border p-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
              <Check className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-semibold">Gata! 🎉</h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              <b className="text-foreground">{name}</b> poate acum să îți gestioneze reclamele. Poți
              revoca accesul oricând din setările tale de Facebook.
            </p>
          </div>
        ) : (
          <div className="card-floating rounded-2xl border border-border p-8">
            {search.err && (
              <div className="mb-5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-3">
                {ERR[search.err] ?? ERR.failed}
              </div>
            )}
            <h1 className="text-2xl font-semibold text-center leading-snug">
              {name} îți cere acces pentru a-ți gestiona reclamele
            </h1>

            <div className="mt-7 space-y-4 text-sm">
              <div>
                <p className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Ce primește acces
                </p>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Pagina ta de Facebook</li>
                  <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Contul tău de reclame</li>
                  <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Lead-urile din campanii</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">Ce NU poate face</p>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li className="flex gap-2"><X className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> Nu poate posta pe pagina ta</li>
                  <li className="flex gap-2"><X className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> Nu vede mesajele tale private</li>
                  <li className="flex gap-2"><X className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> Nu poate schimba parola</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={connect}
              disabled={connecting}
              className="press mt-7 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] text-[15px] font-semibold text-white shadow-lg transition-opacity hover:opacity-95 disabled:opacity-50"
              style={{ background: "#1877F2" }}
            >
              {connecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Facebook className="w-5 h-5" />}
              Conectează cu Facebook
            </button>
          </div>
        )}

        {!agency.white_label && (
          <p className="mt-6 text-center text-xs text-muted-foreground">Powered by AdPilot</p>
        )}
      </div>
    </div>
  );
}
