import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  classifyBusinessNiche,
  createBookingPage,
  getBusinessProfile,
  saveBusinessProfile,
  suggestBookingQuestions,
} from "@/lib/booking/booking.functions";
import { publishBookingCampaign } from "@/lib/booking/publish.functions";
import { getLauncherPlatformStatus } from "@/lib/launcher.functions";
import { uploadAdMedia } from "@/lib/meta-publish.functions";
import { DEFAULT_AVAILABILITY, WEEKDAY_LABELS } from "@/lib/booking/availability";
import type { AvailabilityRule, BookingQuestion } from "@/lib/booking/types";

export const Route = createFileRoute("/_authenticated/programari")({
  head: () => ({
    meta: [
      { title: "Campanie de programări | AdPilot" },
      { name: "description", content: "Creează o campanie Facebook cu pagină proprie de programare și calendar." },
      { property: "og:title", content: "Campanie de programări | AdPilot" },
      { property: "og:description", content: "Pagină de programare generată automat și optimizare pe programări reale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookingWizard,
});

type ServiceDraft = { name: string; duration_min: number; price: number | null };

const STEPS = ["Afacerea ta", "Serviciu & ofertă", "Întrebări", "Program", "Reclamă"];

function BookingWizard() {
  const navigate = useNavigate();
  const loadProfile = useServerFn(getBusinessProfile);
  const saveProfile = useServerFn(saveBusinessProfile);
  const classify = useServerFn(classifyBusinessNiche);
  const suggest = useServerFn(suggestBookingQuestions);
  const createPage = useServerFn(createBookingPage);
  const publish = useServerFn(publishBookingCampaign);
  const platformStatus = useServerFn(getLauncherPlatformStatus);
  const upload = useServerFn(uploadAdMedia);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [biz, setBiz] = useState({
    name: "",
    nicheText: "",
    niche: "general",
    city: "",
    address: "",
    phone: "",
    description: "",
    privacy_policy_url: "",
  });
  const [service, setService] = useState("");
  const [offer, setOffer] = useState("");
  const [services, setServices] = useState<ServiceDraft[]>([{ name: "", duration_min: 60, price: null }]);
  const [questions, setQuestions] = useState<BookingQuestion[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRule[]>(DEFAULT_AVAILABILITY);
  const [ad, setAd] = useState({
    headline: "",
    primary_text: "",
    daily_budget: 50,
    radius_km: 20,
    age_min: 25,
    age_max: 55,
    image_url: "",
  });
  const [accounts, setAccounts] = useState<Array<{ id: string; account_name: string | null }>>([]);
  const [pages, setPages] = useState<Array<{ id: string; name: string }>>([]);
  const [accountId, setAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [result, setResult] = useState<{ booking_url: string } | null>(null);

  useEffect(() => {
    loadProfile({})
      .then((p: any) => {
        if (!p) return;
        setBiz({
          name: p.name ?? "",
          nicheText: p.niche_custom ?? "",
          niche: p.niche ?? "general",
          city: p.city ?? "",
          address: p.address ?? "",
          phone: p.phone ?? "",
          description: p.description ?? "",
          privacy_policy_url: p.privacy_policy_url ?? "",
        });
      })
      .catch(() => {});
    platformStatus({})
      .then((s: any) => {
        setAccounts(s.meta_accounts ?? []);
        setPages(s.meta_pages ?? []);
        setAccountId(s.meta_accounts?.[0]?.id ?? "");
        setPageId(s.meta_pages?.[0]?.id ?? "");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function nextFromBusiness() {
    if (biz.name.trim().length < 2) return toast.error("Scrie numele afacerii.");
    setBusy(true);
    try {
      let niche = biz.niche;
      if (biz.nicheText.trim().length > 2) {
        niche = (await classify({ data: { text: biz.nicheText.trim() } })).niche;
      }
      await saveProfile({
        data: {
          name: biz.name.trim(),
          niche,
          niche_custom: biz.nicheText.trim() || null,
          city: biz.city.trim() || null,
          address: biz.address.trim() || null,
          phone: biz.phone.trim() || null,
          description: biz.description.trim() || null,
          privacy_policy_url: biz.privacy_policy_url.trim() || null,
        },
      });
      setBiz((b) => ({ ...b, niche }));
      setStep(1);
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut salva afacerea.");
    } finally {
      setBusy(false);
    }
  }

  async function nextFromService() {
    if (service.trim().length < 2) return toast.error("Scrie serviciul promovat.");
    if (!services.some((s) => s.name.trim())) {
      setServices([{ name: service.trim(), duration_min: 60, price: null }]);
    }
    setBusy(true);
    try {
      const r = await suggest({ data: { service: service.trim(), offer: offer.trim() || null } });
      setQuestions(r.questions as BookingQuestion[]);
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut genera întrebările.");
    } finally {
      setBusy(false);
    }
  }

  async function onPickImage(file: File) {
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const r = await upload({ data: { filename: file.name, contentType: file.type, base64 } });
      setAd((a) => ({ ...a, image_url: r.url }));
    } catch (e: any) {
      toast.error(e?.message ?? "Încărcarea imaginii a eșuat.");
    } finally {
      setBusy(false);
    }
  }

  async function launch() {
    if (!ad.image_url) return toast.error("Adaugă o imagine pentru reclamă.");
    if (!accountId || !pageId) return toast.error("Alege contul publicitar și pagina de Facebook.");
    setBusy(true);
    try {
      const page = await createPage({
        data: {
          service: service.trim(),
          offer: offer.trim() || null,
          questions: questions.map((q, i) => ({ ...q, position: i })),
          services: services
            .filter((s) => s.name.trim())
            .map((s, i) => ({
              name: s.name.trim(),
              duration_min: s.duration_min,
              price: s.price,
              position: i,
            })),
          availability,
        },
      });

      const copy: any = page.landing_copy ?? {};
      const r = await publish({
        data: {
          booking_campaign_id: page.id,
          ad_account_uuid: accountId,
          page_id: pageId,
          daily_budget: ad.daily_budget,
          duration_days: 30,
          city: biz.city.trim() || null,
          radius_km: ad.radius_km,
          age_min: ad.age_min,
          age_max: ad.age_max,
          genders: [],
          hero_image_url: ad.image_url,
          primary_text: (ad.primary_text || copy.subheadline || `Programează-te la ${biz.name}.`).slice(0, 1000),
          headline: (ad.headline || copy.headline || service).slice(0, 120),
          description: (copy.offer_label ?? "").slice(0, 200),
          launch_active: true,
        },
      });
      setResult({ booking_url: r.booking_url });
      toast.success("Campania de programări e live 🎉");
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut lansa campania.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-14 text-center">
        <div className="w-14 h-14 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto">
          <Check className="w-7 h-7" />
        </div>
        <h1 className="mt-5 font-serif text-3xl">Campania ta de programări e live</h1>
        <p className="mt-3 text-muted-foreground">Pagina ta de programare:</p>
        <a href={result.booking_url} target="_blank" rel="noreferrer" className="mt-2 inline-block underline break-all">
          {result.booking_url}
        </a>
        <div className="mt-8 flex gap-3 justify-center">
          <Link to="/bookings" className="press px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium">
            Vezi programările
          </Link>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="press px-5 py-3 rounded-xl bg-secondary font-medium"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 pb-32">
      <button onClick={() => navigate({ to: "/create" })} className="text-sm text-muted-foreground inline-flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Înapoi
      </button>
      <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight">Campanie de programări</h1>
      <p className="mt-2 text-muted-foreground">
        Îți generăm automat o pagină de programare și optimizăm reclama pe programările reale, nu pe click-uri.
      </p>

      <div className="mt-7 flex items-center gap-2 text-xs">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold ${
                i < step ? "bg-emerald-500 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`truncate ${i === step ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 card-floating p-6 space-y-5">
        {step === 0 && (
          <>
            <Field label="Numele afacerii">
              <Input value={biz.name} onChange={(e) => setBiz((b) => ({ ...b, name: e.target.value }))} placeholder="Salon Bella" />
            </Field>
            <Field label="Domeniu (scrie liber — îl recunoaștem automat)">
              <Input
                value={biz.nicheText}
                onChange={(e) => setBiz((b) => ({ ...b, nicheText: e.target.value }))}
                placeholder="cabinet stomatologic, service auto, sală de fitness…"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Oraș">
                <Input value={biz.city} onChange={(e) => setBiz((b) => ({ ...b, city: e.target.value }))} placeholder="Cluj-Napoca" />
              </Field>
              <Field label="Telefon">
                <Input value={biz.phone} onChange={(e) => setBiz((b) => ({ ...b, phone: e.target.value }))} placeholder="07xx xxx xxx" />
              </Field>
            </div>
            <Field label="Adresă (opțional)">
              <Input value={biz.address} onChange={(e) => setBiz((b) => ({ ...b, address: e.target.value }))} />
            </Field>
            <Field label="Descriere scurtă (opțional)">
              <Textarea
                rows={3}
                value={biz.description}
                onChange={(e) => setBiz((b) => ({ ...b, description: e.target.value }))}
                placeholder="Ce te diferențiază, experiență, echipă…"
              />
            </Field>
            <Nav onNext={nextFromBusiness} busy={busy} nextLabel="Continuă" />
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Serviciul promovat">
              <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="Consultație implant dentar" />
            </Field>
            <Field label="Ofertă (opțional)">
              <Input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Consultație gratuită + plan de tratament" />
            </Field>

            <div>
              <p className="text-sm font-medium">Servicii disponibile la programare</p>
              <div className="mt-3 space-y-3">
                {services.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_90px_90px_36px] gap-2 items-center">
                    <Input
                      value={s.name}
                      placeholder="Nume serviciu"
                      onChange={(e) =>
                        setServices((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                      }
                    />
                    <Input
                      type="number"
                      value={s.duration_min}
                      onChange={(e) =>
                        setServices((list) =>
                          list.map((x, j) => (j === i ? { ...x, duration_min: Number(e.target.value) || 60 } : x)),
                        )
                      }
                    />
                    <Input
                      type="number"
                      placeholder="lei"
                      value={s.price ?? ""}
                      onChange={(e) =>
                        setServices((list) =>
                          list.map((x, j) => (j === i ? { ...x, price: e.target.value ? Number(e.target.value) : null } : x)),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setServices((list) => list.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setServices((l) => [...l, { name: "", duration_min: 60, price: null }])}
                className="mt-3 text-sm inline-flex items-center gap-1.5 text-primary"
              >
                <Plus className="w-4 h-4" /> Adaugă serviciu
              </button>
            </div>

            <Nav onBack={() => setStep(0)} onNext={nextFromService} busy={busy} nextLabel="Generează întrebările" />
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary" /> Întrebări generate pentru serviciul tău — le poți edita.
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.key} className="rounded-xl border border-border p-4">
                  <div className="flex items-start gap-3">
                    <Input
                      value={q.label}
                      onChange={(e) =>
                        setQuestions((list) => list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setQuestions((list) => list.filter((_, j) => j !== i))}
                      className="mt-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{q.type}</span>
                    {q.options?.length ? <span>· {q.options.join(", ")}</span> : null}
                    <label className="inline-flex items-center gap-1.5 ml-auto">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) =>
                          setQuestions((list) => list.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))
                        }
                      />
                      obligatoriu
                    </label>
                  </div>
                </div>
              ))}
              {!questions.length && <p className="text-sm text-muted-foreground">Nicio întrebare — clientul completează doar nume și telefon.</p>}
            </div>
            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} busy={busy} nextLabel="Continuă" />
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-muted-foreground">Programul în care se pot face programări.</p>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                const rule = availability.find((r) => r.weekday === wd);
                return (
                  <div key={wd} className="flex items-center gap-3">
                    <label className="w-28 text-sm inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!rule}
                        onChange={(e) =>
                          setAvailability((list) =>
                            e.target.checked
                              ? [...list, { weekday: wd, start_time: "09:00", end_time: "18:00", slot_min: 30, buffer_min: 0 }]
                              : list.filter((r) => r.weekday !== wd),
                          )
                        }
                      />
                      {WEEKDAY_LABELS[wd]}
                    </label>
                    <Input
                      type="time"
                      disabled={!rule}
                      value={rule?.start_time ?? "09:00"}
                      onChange={(e) =>
                        setAvailability((list) => list.map((r) => (r.weekday === wd ? { ...r, start_time: e.target.value } : r)))
                      }
                      className="w-32"
                    />
                    <Input
                      type="time"
                      disabled={!rule}
                      value={rule?.end_time ?? "18:00"}
                      onChange={(e) =>
                        setAvailability((list) => list.map((r) => (r.weekday === wd ? { ...r, end_time: e.target.value } : r)))
                      }
                      className="w-32"
                    />
                  </div>
                );
              })}
            </div>
            <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} busy={busy} nextLabel="Continuă" />
          </>
        )}

        {step === 4 && (
          <>
            <Field label="Imaginea reclamei">
              {ad.image_url ? (
                <img src={ad.image_url} alt="Reclamă" className="w-full rounded-xl aspect-[4/3] object-cover" />
              ) : null}
              <label className="mt-2 press inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-sm cursor-pointer">
                <Upload className="w-4 h-4" /> {ad.image_url ? "Schimbă imaginea" : "Încarcă imaginea"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onPickImage(e.target.files[0])}
                />
              </label>
            </Field>
            <Field label="Titlu reclamă (lăsat gol = generat de AI)">
              <Input value={ad.headline} onChange={(e) => setAd((a) => ({ ...a, headline: e.target.value }))} />
            </Field>
            <Field label="Text reclamă (lăsat gol = generat de AI)">
              <Textarea rows={3} value={ad.primary_text} onChange={(e) => setAd((a) => ({ ...a, primary_text: e.target.value }))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Buget zilnic (lei)">
                <Input
                  type="number"
                  value={ad.daily_budget}
                  onChange={(e) => setAd((a) => ({ ...a, daily_budget: Number(e.target.value) || 50 }))}
                />
              </Field>
              <Field label="Rază (km)">
                <Input
                  type="number"
                  value={ad.radius_km}
                  onChange={(e) => setAd((a) => ({ ...a, radius_km: Number(e.target.value) || 20 }))}
                />
              </Field>
              <Field label="Vârstă">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={ad.age_min}
                    onChange={(e) => setAd((a) => ({ ...a, age_min: Number(e.target.value) || 25 }))}
                  />
                  <Input
                    type="number"
                    value={ad.age_max}
                    onChange={(e) => setAd((a) => ({ ...a, age_max: Number(e.target.value) || 55 }))}
                  />
                </div>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cont publicitar">
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm"
                >
                  <option value="">Alege…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_name ?? a.id}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pagină Facebook">
                <select
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm"
                >
                  <option value="">Alege…</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Nav onBack={() => setStep(3)} onNext={launch} busy={busy} nextLabel="Lansează campania" />
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      {children}
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  busy,
  nextLabel,
}: {
  onBack?: () => void;
  onNext: () => void;
  busy: boolean;
  nextLabel: string;
}) {
  return (
    <div className="pt-2 flex items-center gap-3">
      {onBack ? (
        <button onClick={onBack} className="press px-4 py-3 rounded-xl bg-secondary text-sm font-medium">
          Înapoi
        </button>
      ) : null}
      <button
        onClick={onNext}
        disabled={busy}
        className="press ml-auto inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {nextLabel}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}