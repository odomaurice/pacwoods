"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { saveSettingsAction } from "@/actions/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/payments";
import { TIME_ZONES, settingsSchema, type Settings } from "@/lib/settings";

type NumberKey = Exclude<keyof Settings, "timeZone" | "currency">;

const GROUPS: Array<{ title: string; text: string; fields: Array<{ key: NumberKey; label: string; unit: string; hint: string; step?: string }> }> = [
  {
    title: "Cutting defaults",
    text: "What every new cutlist starts with. Each job can still change them in its Options.",
    fields: [
      { key: "kerf", label: "Blade kerf", unit: "mm", hint: "Board lost to each saw cut.", step: "0.1" },
      { key: "edgeTrim", label: "Edge trim", unit: "mm", hint: "Trimmed off every sheet edge before cutting.", step: "0.5" },
      { key: "edgeBandThickness", label: "Edge-band thickness", unit: "mm", hint: "Used when a job subtracts banding from cut sizes.", step: "0.1" },
    ],
  },
  {
    title: "Time estimates",
    text: "Your machines' real figures. Estimates shown to staff, operators and clients are calculated from these.",
    fields: [
      { key: "sheetHandlingMin", label: "Handling per sheet", unit: "min", hint: "Loading, positioning and unloading one sheet.", step: "0.5" },
      { key: "secondsPerCut", label: "Time per saw cut", unit: "s", hint: "Average for one cut, including repositioning.", step: "1" },
      { key: "edgingMetresPerMin", label: "Edgebander speed", unit: "m/min", hint: "Feed speed of your edgebander.", step: "0.5" },
      { key: "secondsPerBandedEdge", label: "Handling per banded edge", unit: "s", hint: "Feeding and turning the panel for each edge.", step: "1" },
    ],
  },
];

export default function SettingsForm({ initial }: { initial: Settings }) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<Settings>({ resolver: zodResolver(settingsSchema), defaultValues: initial });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await saveSettingsAction(values);
      if (result.ok) {
        toast.success("Settings saved.");
        reset(values);
      } else setServerError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      {GROUPS.map((g) => (
        <section key={g.title} className="space-y-4 rounded-lg bg-card p-5">
          <div>
            <h2 className="font-semibold">{g.title}</h2>
            <p className="text-sm text-muted-foreground">{g.text}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {g.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <div className="flex items-center gap-2">
                  <Input id={f.key} type="number" inputMode="decimal" step={f.step} className="h-11 max-w-36" aria-invalid={errors[f.key] ? true : undefined} {...register(f.key, { valueAsNumber: true })} />
                  <span className="text-sm text-muted-foreground">{f.unit}</span>
                </div>
                <p className="text-xs text-muted-foreground">{f.hint}</p>
                {errors[f.key] && <p className="text-sm text-destructive">{errors[f.key]?.message}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="space-y-3 rounded-lg bg-card p-5">
        <div>
          <h2 className="font-semibold">Workshop time zone</h2>
          <p className="text-sm text-muted-foreground">Used for greetings and dates on the overview pages.</p>
        </div>
        <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" aria-label="Time zone" {...register("timeZone")}>
          {TIME_ZONES.map((z) => (
            <option key={z} value={z}>
              {z.replace("_", " ")}
            </option>
          ))}
        </select>
      </section>
      <section className="space-y-3 rounded-lg bg-card p-5">
        <div>
          <h2 className="font-semibold">Currency</h2>
          <p className="text-sm text-muted-foreground">Shown on recorded payments. Until you choose, amounts appear as plain numbers.</p>
        </div>
        <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" aria-label="Currency" {...register("currency")}>
          <option value="">Not chosen yet</option>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </section>
      <Button type="submit" disabled={pending || !isDirty} className="h-11 px-6">
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
