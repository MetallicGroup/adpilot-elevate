export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 10 ? 2 : 0 }).format(n || 0);

export const fmtNum = (n: number) => new Intl.NumberFormat("en-US").format(n || 0);

export const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

export const friendlyDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yest)) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};