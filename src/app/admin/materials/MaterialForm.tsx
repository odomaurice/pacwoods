"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createMaterialAction } from "@/actions/catalogue";
import FormField from "@/components/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { materialSchema, type MaterialInput } from "@/lib/schemas";
import { toMm, type LengthUnit } from "@/lib/units";

export default function MaterialForm({ unit = "mm" }: { /** The unit sizes are typed in; the catalogue stores millimetres. */ unit?: LengthUnit }) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MaterialInput>({ resolver: zodResolver(materialSchema), defaultValues: { grain: "NONE" } });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createMaterialAction({
        ...values,
        thicknessMm: toMm(values.thicknessMm, unit),
        sheetLengthMm: Math.round(toMm(values.sheetLengthMm, unit)),
        sheetWidthMm: Math.round(toMm(values.sheetWidthMm, unit)),
      });
      if (result.ok) {
        toast.success(`${values.name} added.`);
        reset({ grain: "NONE" });
      } else {
        setServerError(result.error);
      }
    });
  });

  const num = { valueAsNumber: true } as const;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 panel p-6">
      <h2 className="font-semibold">Add a material</h2>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <FormField id="name" label="Name" placeholder="e.g. White melamine MDF" error={errors.name?.message} {...register("name")} />
        <FormField id="category" label="Category" placeholder="e.g. MDF, Plywood" error={errors.category?.message} {...register("category")} />
        <FormField id="thicknessMm" label={`Thickness (${unit})`} type="number" step="any" inputMode="decimal" error={errors.thicknessMm?.message} {...register("thicknessMm", num)} />
        <FormField id="sheetLengthMm" label={`Sheet length (${unit})`} type="number" step="any" inputMode="numeric" error={errors.sheetLengthMm?.message} {...register("sheetLengthMm", num)} />
        <FormField id="sheetWidthMm" label={`Sheet width (${unit})`} type="number" step="any" inputMode="numeric" error={errors.sheetWidthMm?.message} {...register("sheetWidthMm", num)} />
        <div className="space-y-2">
          <Label htmlFor="grain">Grain</Label>
          <select id="grain" className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" {...register("grain")}>
            <option value="NONE">No grain (parts may rotate)</option>
            <option value="LENGTHWISE">Grain along the sheet length</option>
          </select>
        </div>
        <FormField id="supplier" label="Supplier (optional)" error={errors.supplier?.message} {...register("supplier")} />
      </div>
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Adding…" : "Add material"}
      </Button>
    </form>
  );
}
