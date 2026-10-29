import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Ledger from "@/components/payments/Ledger";
import { RecordOperatorPay } from "@/components/payments/PaymentDialogs";
import { ClientPaymentBadge, JobStatusBadge, OperatorPayBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import ViewButton from "@/components/ViewButton";
import { formatMoney } from "@/lib/payments";
import { STAGE_LABELS } from "@/lib/production";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { User } from "@/server/db/models/User";
import { paymentsOverview } from "@/server/services/payments";
import { getSettings } from "@/server/services/settings";
import { listActiveClientOptions } from "@/server/services/users";

export const metadata: Metadata = { title: "Payments | Pacwoods" };

const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
const VIEWS = [
  { key: "jobs", label: "Clients and jobs" },
  { key: "operators", label: "Operator pay" },
  { key: "ledger", label: "All entries" },
] as const;
type View = (typeof VIEWS)[number]["key"];

/**
 * Payments made outside Pacwoods, as staff recorded them: which jobs each
 * client has paid for, which operators have been paid for which stages, and
 * every entry. Narrow it to one client or one operator to see their side.
 */
export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  const clientId = one(sp.client);
  const operatorId = one(sp.operator);
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : "jobs";

  const [data, settings, clients, operators] = await Promise.all([
    paymentsOverview({ clientId, operatorId }),
    getSettings(),
    listActiveClientOptions(),
    User.find({ role: "OPERATOR" }).select("name status").sort({ name: 1 }).lean(),
  ]);
  const currency = settings.currency || undefined;
  const money = (m: number) => formatMoney(m, currency);
  const clientLabel = clients.find((c) => c.id === clientId)?.label;
  const operatorName = operators.find((o) => o._id.toString() === operatorId)?.name;
  const href = (next: Partial<{ view: View; client: string; operator: string }>) => {
    const q = new URLSearchParams();
    const merged = { view, client: clientId, operator: operatorId, ...next };
    if (merged.view !== "jobs") q.set("view", merged.view);
    if (merged.client) q.set("client", merged.client);
    if (merged.operator) q.set("operator", merged.operator);
    return `/admin/payments${q.size ? `?${q}` : ""}`;
  };
  const t = data.totals;

  return (
    <>
      <PageHeader
        title="Payments"
        description="Payments happen outside Pacwoods. Record them on each job; this page collects them in one place."
      />

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg bg-card p-4" action="/admin/payments">
        {view !== "jobs" && <input type="hidden" name="view" value={view} />}
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Client</span>
          <select name="client" defaultValue={clientId ?? ""} className="h-10 w-64 max-w-full rounded-md border border-input bg-card px-3">
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Operator</span>
          <select name="operator" defaultValue={operatorId ?? ""} className="h-10 w-56 max-w-full rounded-md border border-input bg-card px-3">
            <option value="">All operators</option>
            {operators.map((o) => (
              <option key={o._id.toString()} value={o._id.toString()}>
                {o.name}
                {o.status !== "ACTIVE" ? ` (${o.status.toLowerCase()})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonVariants({ className: "h-10" })}>
          Show
        </button>
        {(clientId || operatorId) && (
          <Link href={href({ client: "", operator: "" })} className={buttonVariants({ variant: "outline", className: "h-10" })}>
            Clear
          </Link>
        )}
      </form>

      {(clientLabel || operatorName) && (
        <p className="mb-4 text-sm">
          Showing {clientLabel && <span className="font-medium">{clientLabel}</span>}
          {clientLabel && operatorName && " and "}
          {operatorName && (
            <>
              jobs where <span className="font-medium">{operatorName}</span> completed a stage
            </>
          )}
          {clientId && (
            <Link href={`/admin/clients/${clientId}`} className="ml-2 underline underline-offset-4">
              Open client
            </Link>
          )}
          {operatorId && (
            <Link href={`/admin/accounts/${operatorId}`} className="ml-2 underline underline-offset-4">
              Open operator
            </Link>
          )}
        </p>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Received from clients" value={money(t.receivedMinor)} />
        <Tile label="Paid to operators" value={money(t.paidOutMinor)} />
        <Tile label="Jobs not paid" value={t.unpaidJobs} href={href({ view: "jobs" })} alert={t.unpaidJobs > 0} />
        <Tile label="Jobs part paid" value={t.partJobs} href={href({ view: "jobs" })} />
        <Tile label="Jobs paid in full" value={t.fullJobs} href={href({ view: "jobs" })} />
        <Tile label="Stages awaiting operator pay" value={t.stagesAwaitingPay} href={href({ view: "operators" })} alert={t.stagesAwaitingPay > 0} />
      </dl>
      <p className="-mt-3 mb-6 text-xs text-muted-foreground">Totals add up the amounts entered; payments recorded without an amount are counted but add nothing.{!currency && " Choose a currency in Settings to show it here."}</p>

      <nav aria-label="Payment views" className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href({ view: v.key })}
            aria-current={v.key === view ? "page" : undefined}
            className={cn("rounded-full px-4 py-2 text-sm font-medium", v.key === view ? "bg-brand-charcoal text-white" : "bg-muted hover:bg-muted/70")}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "jobs" && (
        <Table empty={data.jobs.length === 0 ? "No jobs here." : undefined} head={["Job", "Client", "Job status", "Payment", "Received", "Entries", ""]}>
          {data.jobs.map((j) => (
            <tr key={j.workNumber} className="odd:bg-muted/60 [&>td]:px-3 [&>td]:py-2">
              <td className="whitespace-nowrap">
                <span className="font-mono">{j.workNumber}</span>
                {j.title && <span className="block text-xs text-muted-foreground">{j.title}</span>}
              </td>
              <td>
                <Link href={href({ client: j.clientId })} className="underline-offset-4 hover:underline">
                  {j.clientName}
                </Link>
              </td>
              <td>
                <JobStatusBadge status={j.status} />
              </td>
              <td>
                <ClientPaymentBadge status={j.payment} />
              </td>
              <td className="text-right whitespace-nowrap tabular-nums">{j.receivedMinor ? money(j.receivedMinor) : "—"}</td>
              <td className="text-right tabular-nums">{j.entries}</td>
              <td className="text-right">
                <ViewButton href={`/admin/jobs/${j.workNumber}#payments`} label={`View payments for ${j.workNumber}`} />
              </td>
            </tr>
          ))}
        </Table>
      )}

      {view === "operators" && (
        <Table empty={data.stages.length === 0 ? "No completed stages here yet." : undefined} head={["Job", "Client", "Stage", "Operator", "Completed", "Pay", "Amount", ""]}>
          {data.stages.map((s) => (
            <tr key={s.taskId} className="odd:bg-muted/60 [&>td]:px-3 [&>td]:py-2">
              <td className="font-mono whitespace-nowrap">
                <Link href={`/admin/jobs/${s.workNumber}#payments`} className="underline-offset-4 hover:underline">
                  {s.workNumber}
                </Link>
              </td>
              <td>
                <Link href={href({ client: s.clientId })} className="underline-offset-4 hover:underline">
                  {s.clientName}
                </Link>
              </td>
              <td>{STAGE_LABELS[s.stage]}</td>
              <td>
                {s.operatorId ? (
                  <Link href={href({ operator: s.operatorId })} className="underline-offset-4 hover:underline">
                    {s.operatorName}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="whitespace-nowrap">{s.completedAt ? day.format(s.completedAt) : "—"}</td>
              <td>
                <OperatorPayBadge paid={s.paid} />
              </td>
              <td className="text-right whitespace-nowrap tabular-nums">{s.payment?.amountMinor ? money(s.payment.amountMinor) : "—"}</td>
              <td className="text-right">{!s.paid && <RecordOperatorPay taskId={s.taskId} operatorName={s.operatorName} stage={STAGE_LABELS[s.stage]} currency={currency} />}</td>
            </tr>
          ))}
        </Table>
      )}

      {view === "ledger" && <Ledger rows={data.ledger} currency={currency} />}
    </>
  );
}

function Tile({ label, value, href, alert }: { label: string; value: string | number; href?: string; alert?: boolean }) {
  return (
    <div className={cn("relative rounded-lg bg-card p-4", href && "hover:bg-muted/60")}>
      <dt className="text-xs text-muted-foreground">
        {href ? (
          <Link href={href} className="after:absolute after:inset-0">
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className={cn("mt-1 font-semibold break-words tabular-nums", typeof value === "number" ? "text-xl" : "text-lg", alert && "text-brand-gold-deep")}>{value}</dd>
    </div>
  );
}

function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  if (empty) return <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg bg-card">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:whitespace-nowrap">
            {head.map((h, i) => (
              <th key={i} className={h === "Received" || h === "Entries" || h === "Amount" ? "text-right" : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
