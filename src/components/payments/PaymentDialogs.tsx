"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordClientPaymentAction, recordOperatorPaymentAction, voidPaymentAction, type PaymentResult } from "@/actions/payments";
import ConfirmAction from "@/components/ConfirmAction";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, clientPaymentSchema, operatorPaymentSchema, type PaymentMethod } from "@/lib/payments";

type Entry = { amount: string; method: PaymentMethod | ""; paidOn: string; note: string };
const blank = (): Entry => ({ amount: "", method: "", paidOn: new Date().toISOString().slice(0, 10), note: "" });

function useResult() {
  const router = useRouter();
  return (result: PaymentResult, success: string) => {
    if (result.ok) {
      toast.success(success);
      router.refresh();
      return true;
    }
    toast.error(result.error);
    return false;
  };
}

/** Amount, method, date and note: the same four fields on every payment. */
export function EntryFields({ id, value, onChange, currency }: { id: string; value: Entry; onChange: (v: Entry) => void; currency?: string }) {
  return (
    <span className="grid gap-3 sm:grid-cols-2">
      <span className="block space-y-1">
        <Label htmlFor={`${id}-amount`}>Amount{currency ? ` (${currency})` : ""}, optional</Label>
        <Input id={`${id}-amount`} inputMode="decimal" placeholder="e.g. 150000" className="h-11" value={value.amount} onChange={(e) => onChange({ ...value, amount: e.target.value })} />
      </span>
      <span className="block space-y-1">
        <Label htmlFor={`${id}-method`}>How it was paid</Label>
        <select id={`${id}-method`} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" value={value.method} onChange={(e) => onChange({ ...value, method: e.target.value as Entry["method"] })}>
          <option value="">Not recorded</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </span>
      <span className="block space-y-1">
        <Label htmlFor={`${id}-date`}>Date paid</Label>
        <Input id={`${id}-date`} type="date" className="h-11" max={new Date().toISOString().slice(0, 10)} value={value.paidOn} onChange={(e) => onChange({ ...value, paidOn: e.target.value })} />
      </span>
      <span className="block space-y-1 sm:col-span-2">
        <Label htmlFor={`${id}-note`}>Note, optional</Label>
        <Textarea id={`${id}-note`} rows={2} placeholder="e.g. receipt number, who received it" value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      </span>
    </span>
  );
}

export function RecordClientPayment({ workNumber, fullyPaid, currency }: { workNumber: string; fullyPaid: boolean; currency?: string }) {
  const done = useResult();
  const [coverage, setCoverage] = useState<"PART" | "FULL">(fullyPaid ? "PART" : "FULL");
  const [entry, setEntry] = useState(blank);
  return (
    <ConfirmAction
      label="Record client payment"
      title={`Payment for ${workNumber}`}
      description={
        <span className="block space-y-4 text-left">
          <span className="block">Record money the client paid outside Pacwoods.</span>
          <span role="radiogroup" aria-label="How much of the job this pays" className="grid grid-cols-2 gap-2">
            {(["PART", "FULL"] as const).map((c) => (
              <label key={c} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-muted px-3 text-sm has-checked:bg-accent has-checked:font-medium">
                <input type="radio" name="coverage" className="size-4 accent-brand-charcoal" checked={coverage === c} onChange={() => setCoverage(c)} />
                {c === "PART" ? "Part payment" : "Paid in full"}
              </label>
            ))}
          </span>
          <EntryFields id="cp" value={entry} onChange={setEntry} currency={currency} />
        </span>
      }
      confirmLabel="Record payment"
      onConfirm={async () => {
        const parsed = clientPaymentSchema.safeParse({ coverage, ...entry });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check the payment.");
          return false;
        }
        const ok = done(await recordClientPaymentAction(workNumber, parsed.data), "Payment recorded.");
        if (ok) setEntry(blank());
        return ok;
      }}
    />
  );
}

export function RecordOperatorPay({ taskId, operatorName, stage, currency }: { taskId: string; operatorName: string; stage: string; currency?: string }) {
  const done = useResult();
  const [entry, setEntry] = useState(blank);
  return (
    <ConfirmAction
      label="Mark as paid"
      title={`Has ${operatorName} been paid for ${stage.toLowerCase()}?`}
      description={
        <span className="block space-y-4 text-left">
          <span className="block">Record pay given outside Pacwoods. Each completed stage is paid once.</span>
          <EntryFields id="op" value={entry} onChange={setEntry} currency={currency} />
        </span>
      }
      confirmLabel="Record pay"
      onConfirm={async () => {
        const parsed = operatorPaymentSchema.safeParse(entry);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check the payment.");
          return false;
        }
        return done(await recordOperatorPaymentAction(taskId, parsed.data), `${operatorName}'s pay recorded.`);
      }}
    />
  );
}

export function VoidPayment({ paymentId }: { paymentId: string }) {
  const done = useResult();
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label="Void"
      destructive
      title="Void this entry?"
      description={
        <span className="block space-y-2 text-left">
          <span className="block">Use this for a mistake. The entry stays on record, crossed out, with your reason.</span>
          <Label htmlFor="void-reason">Why is it wrong?</Label>
          <Textarea id="void-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </span>
      }
      confirmLabel="Void entry"
      onConfirm={async () => done(await voidPaymentAction(paymentId, reason), "Entry voided.")}
    />
  );
}
