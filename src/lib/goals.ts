import { ShoppingBag, CalendarCheck, Users, PhoneCall } from "lucide-react";

export type GoalId = "sales" | "bookings" | "leads" | "calls";

export const GOAL_STORAGE_KEY = "adpilot:goal";

export const GOAL_IDS: GoalId[] = ["sales", "bookings", "leads", "calls"];

export function isGoalId(v: unknown): v is GoalId {
  return typeof v === "string" && (GOAL_IDS as string[]).includes(v);
}

export const GOAL_META: Record<
  GoalId,
  {
    icon: typeof ShoppingBag;
    label: string;
    short: string;
    confirm: string;
    setupTitle: string;
    setupDesc: string;
  }
> = {
  sales: {
    icon: ShoppingBag,
    label: "Mai multe vânzări",
    short: "Magazin online sau produse fizice",
    confirm:
      "Perfect. AdPilot construiește o campanie de conversii care duce clienții direct la produsele tale.",
    setupTitle: "Conectăm magazinul tău",
    setupDesc:
      "Căutăm automat Pixelul din contul tău Meta ca reclamele să învețe din vânzările reale.",
  },
  bookings: {
    icon: CalendarCheck,
    label: "Mai multe programări",
    short: "Salon, clinică, service, consultanță",
    confirm:
      "Perfect. Primești o pagină de programări + reclame optimizate pentru rezervări reale.",
    setupTitle: "Îți construim pagina de programări",
    setupDesc: "Răspunde la 3 întrebări, iar AdPilot scrie și publică pagina în locul tău.",
  },
  leads: {
    icon: Users,
    label: "Mai mulți clienți potențiali",
    short: "Servicii, imobiliare, educație",
    confirm:
      "Perfect. AdPilot lansează campanii de lead generation, iar fiecare lead ajunge pe WhatsApp.",
    setupTitle: "Îți construim pagina de ofertă",
    setupDesc: "Trei întrebări și ai o pagină cu formular scurt, optimizată pentru lead-uri.",
  },
  calls: {
    icon: PhoneCall,
    label: "Mai multe apeluri",
    short: "Vrei clienți care sună direct",
    confirm: "Perfect. Reclamele tale vor avea buton de apel, optimizate pentru telefoane care sună.",
    setupTitle: "Pe ce număr vrei să te sune?",
    setupDesc: "Îți completăm noi restul: textele, publicul și butonul de apel.",
  },
};

export const GOALS = GOAL_IDS.map((id) => ({ id, ...GOAL_META[id] }));

/** Obiectivele care produc un landing page AdPilot. */
export function usesLandingPage(goal: GoalId) {
  return goal === "bookings" || goal === "leads" || goal === "calls";
}
