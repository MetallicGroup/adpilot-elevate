/**
 * „Doctorul” de erori Meta: transformă o eroare brută (cod, mesaj) într-un pas clar pentru om,
 * cu linkul exact. Tichet către echipă doar când problema nu e una cunoscută.
 *
 * Pur: fără apeluri la Meta. Folosit la publicare, la verificarea de după lansare și de agent.
 */

export type MetaProblemKind =
  | "checkpoint"
  | "profile_restricted"
  | "unsettled"
  | "account_closed"
  | "account_disabled"
  | "no_payment"
  | "lead_terms"
  | "permission"
  | "rate_limit"
  | "dsa"
  | "media"
  | "policy"
  | "targeting"
  | "unknown";

export type MetaProblem = {
  kind: MetaProblemKind;
  /** Mesajul pentru om, gata de trimis pe WhatsApp. */
  user_message: string;
  link?: string;
  /** Omul o rezolvă singur în câteva minute; după aceea reîncercăm. */
  fixable_by_user: boolean;
  /** Ce poate face sistemul singur (ex. alt cont de reclame). */
  auto_fix?: "switch_ad_account" | "wait_then_retry";
  /** Doar pentru probleme necunoscute: se deschide tichet. */
  needs_human: boolean;
};

export type MetaProblemContext = {
  adAccountId?: string | null;
  pageId?: string | null;
  /** Suma datorată (pentru contul nedecontat), dacă o știm. */
  amountDue?: string | null;
};

const ADS_MANAGER = "https://adsmanager.facebook.com/adsmanager/manage/campaigns";
const ACCOUNT_QUALITY = "https://www.facebook.com/accountquality";

function billingLink(act?: string | null) {
  return act
    ? `https://business.facebook.com/ads/manager/account_settings/account_billing/?act=${act}`
    : "https://business.facebook.com/billing_hub/payment_settings";
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Explică o eroare Meta. `raw` = mesajul (poate conține „#cod/subcod”). */
export function explainMetaError(raw: string, ctx: MetaProblemContext = {}): MetaProblem {
  const m = norm(raw ?? "");
  const act = ctx.adAccountId ?? null;

  if (/3858385|te autentifici cu contul|log ?in(to)? (to )?your account|requires the user to take a pending action|cineva sa fi incercat sa-?ti acceseze/.test(m)) {
    return {
      kind: "checkpoint",
      user_message:
        "Facebook vrea să confirme că ești chiar tu înainte să mai creeze reclame noi (o verificare de securitate, nu o blocare). " +
        `Intră o dată în Ads Manager de pe telefonul sau laptopul tău obișnuit: ${ADS_MANAGER}` +
        (act ? `?act=${act}` : "") +
        " — dacă îți apare „Ai fost tu?” sau o verificare, confirm-o. Apoi scrie-mi *gata* și pornesc reclama, fără să reluăm nimic.",
      link: act ? `${ADS_MANAGER}?act=${act}` : ADS_MANAGER,
      fixable_by_user: true,
      needs_human: false,
    };
  }
  if (/restricted from advertising|advertising (access|account) (is )?restricted|ad ?account (has been )?restricted|restrictionat|blocat temporar accesul|temporarily blocked|1404078|2859015|1487390|you can'?t run ads|nu poti difuza reclame/.test(m)) {
    return {
      kind: "profile_restricted",
      user_message:
        "Profilul tău de Facebook are o restricție la reclame, pusă de Meta. Nu e ceva ce putem ocoli din AdPilot, dar poți cere o revizuire în câteva minute: " +
        `${ACCOUNT_QUALITY} → alege restricția → „Solicită o revizuire”. De obicei răspund în 1–3 zile. Când se ridică, scrie-mi *gata* și pornim.`,
      link: ACCOUNT_QUALITY,
      fixable_by_user: true,
      needs_human: false,
    };
  }
  if (/unsettled|sold neplatit|outstanding balance|neachitat|1359188|account_status.?3\b|status 3\b/.test(m)) {
    return {
      kind: "unsettled",
      user_message:
        `Contul de reclame are o sumă neplătită la Facebook${ctx.amountDue ? ` (${ctx.amountDue})` : ""}, așa că Meta nu pornește reclame noi până nu e achitată. ` +
        `Plătește aici: ${billingLink(act)} — apoi scrie-mi *gata* și pornesc reclama.`,
      link: billingLink(act),
      fixable_by_user: true,
      needs_human: false,
    };
  }
  if (/account (is )?closed|cont(ul)? (de reclame )?(este )?inchis|status 101|status 100|pending closure/.test(m)) {
    return {
      kind: "account_closed",
      user_message: "Contul de reclame ales e închis la Facebook. Trec pe alt cont de reclame activ, dacă ai unul.",
      fixable_by_user: false,
      auto_fix: "switch_ad_account",
      needs_human: false,
    };
  }
  if (/account (is )?disabled|dezactivat|status 2\b|disable_reason/.test(m)) {
    return {
      kind: "account_disabled",
      user_message:
        `Contul de reclame e dezactivat de Facebook. Vezi motivul și cere revizuirea aici: ${ACCOUNT_QUALITY}. Între timp pot folosi alt cont de reclame activ, dacă ai unul.`,
      link: ACCOUNT_QUALITY,
      fixable_by_user: true,
      auto_fix: "switch_ad_account",
      needs_human: false,
    };
  }
  if (/payment method|funding source|no valid (payment|funding)|metoda de plata|lipseste cardul|1359101|add a payment/.test(m)) {
    return {
      kind: "no_payment",
      user_message: `Contul de reclame n-are card adăugat la Facebook. Adaugă-l aici (2 minute): ${billingLink(act)} — apoi scrie-mi *gata*.`,
      link: billingLink(act),
      fixable_by_user: true,
      needs_human: false,
    };
  }
  if (/leadgen|lead ads terms|lead generation terms|\btos\b|conditiile meta pentru (reclame cu )?formular/.test(m)) {
    const link = ctx.pageId ? `https://business.facebook.com/latest/instant_forms?asset_id=${ctx.pageId}` : undefined;
    return {
      kind: "lead_terms",
      user_message:
        "Pagina ta n-a acceptat încă Condițiile Meta pentru reclame cu formular (un singur „Accept”, o dată). " +
        (link ? `Deschide ${link} → „Creează formular” → „Accept”, apoi închide. ` : "") +
        "Scrie-mi *gata* după aceea.",
      link,
      fixable_by_user: true,
      needs_human: false,
    };
  }
  if (/pages_manage_ads|\(#200\)|#200\b|\(#10\)|#10\b|permission|oauth|token (has )?expired|session has expired|#190\b/.test(m)) {
    return {
      kind: "permission",
      user_message:
        "Conexiunea cu Facebook trebuie reînnoită (lipsește o permisiune sau a expirat). Îți trimit linkul personal de conectare; dă „Continuă” și bifează pagina și contul de reclame.",
      fixable_by_user: true,
      needs_human: false,
    };
  }
  if (/too many calls|rate.?limit|call limit|#17\b|#613\b|#80004\b/.test(m)) {
    return {
      kind: "rate_limit",
      user_message: "Facebook ne-a cerut o pauză scurtă (prea multe operații deodată). Reîncerc automat în 15–30 de minute; reclama rămâne salvată.",
      fixable_by_user: false,
      auto_fix: "wait_then_retry",
      needs_human: false,
    };
  }
  if (/beneficiar|beneficiary|payer|payor|person or organization|organization being promoted|\bdsa\b/.test(m)) {
    return {
      kind: "dsa",
      user_message: "Meta cere numele exact al firmei sau al persoanei promovate (regulă UE). Scrie-mi denumirea și reîncerc.",
      fixable_by_user: true,
      needs_human: false,
    };
  }
  if (/adimage|advideo|image hash|thumbnail|video processing|media|format (not )?supported/.test(m)) {
    return {
      kind: "media",
      user_message: "Facebook n-a acceptat poza sau clipul. Trimite-l din nou (JPG/PNG sau MP4) și reîncerc.",
      fixable_by_user: true,
      needs_human: false,
    };
  }
  if (/disapprove|rejected|advertising standards|policy|politic/.test(m)) {
    return {
      kind: "policy",
      user_message: "Facebook n-a acceptat textul sau imaginea (regulile lor de publicitate). Refac textul fără afirmații absolute și reîncerc.",
      fixable_by_user: false,
      needs_human: false,
    };
  }
  if (/\bage\b|age_max|age_min|targeting|geo_locations|\bcity\b|audience|varst/.test(m)) {
    return {
      kind: "targeting",
      user_message: "Facebook n-a acceptat publicul ales (vârstă sau zonă). Ajustez și reîncerc.",
      fixable_by_user: false,
      needs_human: false,
    };
  }
  return {
    kind: "unknown",
    user_message: `Facebook a refuzat pasul ăsta: ${String(raw).slice(0, 300)}`,
    fixable_by_user: false,
    needs_human: true,
  };
}

/** Problema din `issues_info` al unei reclame (ex. reclamă oprită de Meta după creare). */
export function explainAdIssues(
  issues: Array<{ error_code?: number; error_summary?: string; error_message?: string }> | undefined,
  ctx: MetaProblemContext = {},
): MetaProblem | null {
  const first = issues?.[0];
  if (!first) return null;
  return explainMetaError(`${first.error_summary ?? ""} ${first.error_message ?? ""} #${first.error_code ?? ""}`, ctx);
}
