import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBillingHistory, type BillingInvoice } from "@/lib/payments.functions";
import { getStripeEnvironment, paymentsTokenAvailable } from "@/lib/stripe";
import { Download, ExternalLink, FileText, Receipt, CalendarClock } from "lucide-react";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency: (currency || "ron").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    paid: "bg-success/15 text-success",
    open: "bg-orange-500/15 text-orange-600",
    draft: "bg-muted text-muted-foreground",
    uncollectible: "bg-destructive/15 text-destructive",
    void: "bg-muted text-muted-foreground",
  };
  const cls = (status && map[status]) || "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {status ?? "—"}
    </span>
  );
}

function InvoiceRow({ inv }: { inv: BillingInvoice }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30">
      <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{inv.number ?? inv.id}</p>
          <StatusPill status={inv.status} />
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {fmtDate(inv.created)} · {inv.description ?? "Abonament"}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold">
          {fmtMoney(inv.status === "paid" ? inv.amount_paid : inv.amount_due, inv.currency)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {inv.hosted_invoice_url && (
          <a
            href={inv.hosted_invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-secondary"
            title="Deschide chitanța"
          >
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>
        )}
        {inv.pdf_url && (
          <a
            href={inv.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-secondary"
            title="Descarcă PDF"
          >
            <Download className="w-4 h-4 text-muted-foreground" />
          </a>
        )}
      </div>
    </div>
  );
}

export function BillingHistory() {
  const tokenOk = paymentsTokenAvailable();
  const env = tokenOk ? getStripeEnvironment() : null;
  const fetchHistory = useServerFn(getBillingHistory);

  const { data, isLoading, error } = useQuery({
    queryKey: ["billing-history", env],
    queryFn: () => fetchHistory({ data: { environment: env! } }),
    enabled: !!env,
    refetchOnWindowFocus: false,
  });

  if (!tokenOk) {
    return <p className="text-sm text-muted-foreground">Plățile nu sunt configurate pentru acest mediu.</p>;
  }
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Se încarcă istoricul…</p>;
  }
  if (error || (data && "error" in data)) {
    return (
      <p className="text-sm text-destructive">
        Nu am putut încărca istoricul: {(error as Error)?.message ?? (data as any)?.error}
      </p>
    );
  }

  const invoices = (data && "invoices" in data) ? data.invoices : [];
  const upcoming = (data && "upcoming" in data) ? data.upcoming : null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <CalendarClock className="w-3.5 h-3.5" />
          Următoarea facturare
        </div>
        {upcoming ? (
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-2xl font-semibold">
                {fmtMoney(upcoming.amount_due, upcoming.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {upcoming.description ?? "Abonament"} ·{" "}
                {upcoming.next_payment_attempt
                  ? `pe ${fmtDate(upcoming.next_payment_attempt)}`
                  : upcoming.period_end
                    ? `la finalul perioadei ${fmtDate(upcoming.period_end)}`
                    : "—"}
              </p>
            </div>
            <Receipt className="w-6 h-6 text-muted-foreground" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Nu există o factură programată momentan.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">
          Istoric facturi
        </p>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">
            Nu există facturi încă. Prima factură apare aici după ce se încheie trialul.
          </p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} inv={inv} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}