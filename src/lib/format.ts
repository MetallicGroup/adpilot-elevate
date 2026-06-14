export const fmtMoney = (n: number) => {
  const v = n || 0;
  const digits = v < 10 ? 2 : 0;
  return `${new Intl.NumberFormat("ro-RO", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)} lei`;
};

export const fmtNum = (n: number) => new Intl.NumberFormat("ro-RO").format(n || 0);

export const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

export const friendlyDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Azi";
  if (sameDay(date, yest)) return "Ieri";
  return date.toLocaleDateString("ro-RO", { month: "short", day: "numeric" });
};