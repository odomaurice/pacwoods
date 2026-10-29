import type { Types } from "mongoose";
import Link from "next/link";
import Ledger from "@/components/payments/Ledger";
import { RecordClientPayment, RecordOperatorPay } from "@/components/payments/PaymentDialogs";
import { ClientPaymentBadge, OperatorPayBadge } from "@/components/StatusBadge";
import { formatMoney } from "@/lib/payments";
import { STAGE_LABELS } from "@/lib/production";
import { jobPayments } from "@/server/services/payments";
import { getSettings } from "@/server/services/settings";

const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/** The job page's payments: what the client has paid, and pay for each operator who completed a stage. */
export default async function JobPayments({ jobId, workNumber }: { jobId: Types.ObjectId; workNumber: string }) {
  const [p, settings] = await Promise.all([jobPayments(jobId), getSettings()]);
  const currency = settings.currency || undefined;
  const liveClient = p.clientEntries.filter((e) => !e.voided);
  const received = liveClient.reduce((a, e) => a + (e.amountMinor ?? 0), 0);
  const unpaidOperators = p.stages.filter((s) => !s.payment);
  const completed = p.jobStatus === "COMPLETED";

  return (
    <section id="payments" aria-labelledby="payments-title" className="mb-8 scroll-mt-20 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="payments-title" className="text-lg font-semibold">
          Payments
        </h2>
        <Link href={`/admin/payments`} className="ml-auto text-sm underline-offset-4 hover:underline">
          All payments →
        </Link>
      </div>

      {completed && unpaidOperators.length > 0 && (
        <div className="rounded-lg bg-accent p-4 text-sm">
          <p className="font-medium">This job is complete. Have the operators been paid?</p>
          <p className="text-muted-foreground">Record each one below once they have been paid.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">From the client</h3>
            <ClientPaymentBadge status={p.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {liveClient.length === 0
              ? "No payment recorded."
              : `${liveClient.length === 1 ? "1 payment" : `${liveClient.length} payments`} recorded${received ? ` · ${formatMoney(received, currency)} in total` : ""}.`}
          </p>
          <RecordClientPayment workNumber={workNumber} fullyPaid={p.status === "FULL"} currency={currency} />
        </div>

        <div className="space-y-3 rounded-lg bg-card p-5">
          <h3 className="font-semibold">To operators</h3>
          {p.stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Operators are paid per stage once it is completed. Nothing is completed yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {p.stages.map((s) => (
                <li key={s.taskId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                  <span className="min-w-0 flex-1">
                    <Link href={s.operatorId ? `/admin/payments?operator=${s.operatorId}` : "#"} className="font-medium underline-offset-4 hover:underline">
                      {s.operatorName}
                    </Link>
                    <span className="block text-sm text-muted-foreground">
                      {STAGE_LABELS[s.stage]}
                      {s.completedAt && ` · completed ${day.format(s.completedAt)}`}
                      {s.payment?.amountMinor && ` · ${formatMoney(s.payment.amountMinor, currency)}`}
                    </span>
                  </span>
                  <OperatorPayBadge paid={Boolean(s.payment)} />
                  {!s.payment && <RecordOperatorPay taskId={s.taskId} operatorName={s.operatorName} stage={STAGE_LABELS[s.stage]} currency={currency} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {p.ledger.length > 0 && <Ledger rows={p.ledger} currency={currency} showJob={false} />}
    </section>
  );
}
