"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * A button that asks before doing something consequential. The action runs
 * on the server, which re-checks permission; this dialog is only the "are
 * you sure".
 */
export default function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  destructive = false,
  large = false,
  disabled = false,
  onConfirm,
}: {
  label: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Big touch target, for the workshop floor. */
  large?: boolean;
  disabled?: boolean;
  /** Return false to keep the dialog open (e.g. the form inside it is invalid). */
  onConfirm: () => Promise<void | boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        disabled={disabled}
        render={<Button variant={destructive ? "destructive" : large ? "default" : "outline"} size={large ? "lg" : "sm"} className={large ? "h-12 px-6 text-base" : undefined} />}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if ((await onConfirm()) !== false) setOpen(false);
              })
            }
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
