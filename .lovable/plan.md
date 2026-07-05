## Audit auth curent (ce am găsit)

**Rupt / lipsă:**
1. **Signup email cu confirmare = crash mut.** `auth.tsx` face `signUp` apoi imediat `ensureSessionAfterSignUp` care apelează `signInWithPassword`. Cu email confirmation ON (ce vrei), Supabase răspunde `Email not confirmed` și userul primește doar un toast roșu. Nicio pagină "confirmă emailul", niciun buton resend.
2. **Nicio pagină `/auth/confirm-email`** — după signup, userul rămâne blocat pe formular.
3. **`/auth/callback` nu tratează scenariul "am dat click pe linkul din mail"** distinct — merge la `/onboarding` fără feedback (nu apare "Emailul tău e confirmat ✓").
4. **Forgot password lipsă.** Există `/reset-password` care consumă tokenul, dar nu există buton "Am uitat parola" pe `/auth` și nici funcția `resetPasswordForEmail`.
5. **Reset password redirect greșit** — trimite mereu la `/onboarding`, chiar dacă userul are onboarding făcut (ar trebui `resolvePostAuthPath`).
6. **Google fără ecran de bun venit** (ai cerut unul scurt).
7. **Meta callback trimite mereu la `/settings`** — dacă userul a pornit Meta din `/onboarding`, e aruncat la Settings, rupe flow-ul de onboarding.
8. **Meta callback fără feedback UI stilizat** — doar query param `meta=error&reason=xyz`, mesajele nu sunt afișate frumos peste tot.
9. **Signup cu email deja existent** → mesaj Supabase în engleză, fără CTA "Ai deja cont? Loghează-te".
10. **`auth.tsx`** are dublă redirecționare (getSession în useEffect + goPostAuth), risc de flash.

---

## Plan de fix (în ordine)

### Faza 1 — Supabase config
- Setez `auto_confirm_email: false`, `disable_signup: false`, `password_hibp_enabled: true` prin `supabase--configure_auth`.
- Confirm că template-urile de auth email există (dacă nu, scaffold cu `scaffold_auth_email_templates` — cere domeniu de email).

### Faza 2 — Pagini noi frumoase
- **`/auth/confirm-email?email=…`** — ecran cu icon email, "Ți-am trimis un link la `x@y.com`", buton **Retrimite** (rate-limited 60s), buton **Schimbă email** (revine la signup), linkuri deschide Gmail/Outlook.
- **`/auth/verified`** — landing scurt după click în mail: check verde animat "Emailul tău e confirmat", auto-redirect 2s spre `/onboarding` sau `/dashboard` (via `resolvePostAuthPath`).
- **`/auth/welcome`** — ecran scurt după Google login pentru useri noi (numele + "Hai să conectăm contul Meta"), buton "Continuă" → `/onboarding`.
- **`/forgot-password`** — input email + `resetPasswordForEmail` cu `redirectTo` corect, apoi ecran "Verifică emailul".

### Faza 3 — Fix flow existent
- **`src/routes/auth.tsx`**:
  - Signup: NU mai chem `ensureSessionAfterSignUp`. Dacă `data.session === null`, redirect la `/auth/confirm-email?email=…`.
  - Detectez `identities: []` din Supabase (semnal "email already exists") și afișez CTA "Ai deja cont, loghează-te".
  - Adaug link "Am uitat parola" în mode `signin`.
  - Elimin dubla redirecționare (o singură cale prin `onAuthStateChange`).
  - Traduc erorile comune Supabase (`Invalid login credentials`, `Email not confirmed`, `User already registered`) în română.
- **`src/routes/auth.callback.tsx`**:
  - Detectez `type=signup` / `type=recovery` / `type=email_change` și redirect la `/auth/verified`, `/reset-password`, respectiv `/auth/email-changed`.
  - Pentru Google (fără type): dacă e user nou (created_at ≈ now, no meta connection), redirect la `/auth/welcome`; altfel `resolvePostAuthPath`.
- **`src/routes/reset-password.tsx`**: după succes → `resolvePostAuthPath()` în loc de hard `/onboarding`.
- **`src/lib/auth.ts`**: elimin `ensureSessionAfterSignUp` (nu mai are sens cu confirmarea obligatorie).

### Faza 4 — Meta OAuth polish
- `startMetaOAuth`: primește param `returnTo` (`/onboarding` sau `/settings`), îl semnez în cookie separat.
- `api/meta.auth.callback.ts`: la final redirect la `returnTo` cu `?meta=connected` / `?meta=error&reason=…`.
- Component nou `<MetaConnectStatus />` folosit în `/settings` și `/onboarding` care citește query params și afișează toast + banner clar (success verde, erori explicative în română: `pages_manage_ads_missing` → "Trebuie să acorzi permisiunea de management pagini", `bad_state` → "Sesiune expirată, încearcă din nou").
- Buton "Deconectează Meta" în Settings care șterge `meta_connections` + revocă tokenul.

### Faza 5 — Design consistency
- Toate paginile auth (`/auth`, `/auth/confirm-email`, `/auth/verified`, `/auth/welcome`, `/forgot-password`, `/reset-password`) folosesc același layout: header cu logo + back link, card centrat max-w-sm, font serif titlu, motion fade-in.
- Iconografie unitară din `lucide-react` (Mail, MailCheck, Sparkles, ShieldCheck).
- Toast-uri sonner cu mesaje românești consistente.

### Faza 6 — Verificare
- Rulez `tsgo --noEmit` după fiecare fază.
- Playwright smoke: signup manual → landing confirm-email, click retrimite; Google login flow (mockable); forgot password flow.

---

## Ce las neatins
- Structura DB (profiles trigger e ok).
- Onboarding logic (`resolvePostAuthPath`).
- `_authenticated/route.tsx` (managed).
- Stripe/checkout.

## Impact / risc
- Userii existenți neconfirmați: după activarea confirmării obligatorii **nu se mai pot loga cu parola** până nu confirmă emailul. Pot să adaug un flow "retrimite confirmare" din `/auth`.
- Necesită template Supabase auth email cu link către `/auth/callback` (dacă nu e domeniu email setat, îți zic să rulăm setup email întâi).

Ordine de execuție: **Faza 1 → 2 → 3 → 4 → 5 → 6**, cu commit după fiecare fază ca să pot da rollback selectiv.