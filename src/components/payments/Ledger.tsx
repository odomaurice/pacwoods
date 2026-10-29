import Link from "next/link";
import { VoidPayment } from "@/components/payments/PaymentDialogs";
import { PAYMENT_METHOD_LABELS, formatMoney } from "@/lib/payments";
import { STAGE_LABELS } from "@/lib/production";
import { cn } from "@/lib/utils";
import type { LedgerRow } from "@/server/services/payments";

const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/** Recorded payments, newest first; voided entries stay visible, struck through. */
export default function Ledger({ rows, currency, showJob = true, canVoid = true }: { rows: LedgerRow[]; currency?: string; showJob?: boolean; canVoid?: boolean }) {
  if (rows.length === 0) return <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">No payments recorded yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg bg-card">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:whitespace-nowrap">
            <th>Date</th>
            {showJob && <th>Job</th>}
            <th>What</th>
            <th>Who</th>
            <th className="text-right">Amount</th>
            <th>Method</th>
            <th>Recorded by</th>
            {canVoid && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={cn("align-top odd:bg-muted/60 [&>td]:px-3 [&>td]:py-2", r.voided && "text-muted-foreground")}>
              <td className="whitespace-nowrap">{day.format(r.paidAt)}</td>
              {showJob && (
                <td className="whitespace-nowrap">
                  <Link href={`/admin/jobs/${r.workNumber}#payments`} className="font-mono underline-offset-4 hover:underline">
                    {r.workNumber}
                  </Link>
                </td>
              )}
              <td className={cn(r.voided && "line-through")}>
                {r.kind === "CLIENT" ? (r.coverage === "FULL" ? "Client paid in full" : "Client part payment") : `Operator pay · ${STAGE_LABELS[r.stage!]}`}
                {r.note && <span className="block text-xs text-muted-foreground no-underline">{r.note}</span>}
                {r.voided && (
                  <span className="block text-xs">
                    Voided by {r.voided.by}: {r.voided.reason}
                  </span>
                )}
              </td>
              <td>
                {r.kind === "CLIENT" ? (
                  <Link href={`/admin/payments?client=${r.clientId}`} className="underline-offset-4 hover:underline">
                    {r.clientName}
                  </Link>
                ) : (
                  <Link href={`/admin/payments?operator=${r.operatorId}`} className="underline-offset-4 hover:underline">
                    {r.operatorName}
                  </Link>
                )}
              </td>
              <td className={cn("text-right whitespace-nowrap tabular-nums", r.voided && "line-through")}>{formatMoney(r.amountMinor, currency)}</td>
              <td>{r.method ? PAYMENT_METHOD_LABELS[r.method] : "—"}</td>
              <td>{r.recordedBy}</td>
              {canVoid && <td className="text-right">{!r.voided && <VoidPayment paymentId={r.id} />}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
