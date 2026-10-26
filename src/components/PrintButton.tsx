"use client";

import { Button } from "@/components/ui/button";

export default function PrintButton({ label = "Print" }: { label?: string }) {
  return <Button onClick={() => window.print()}>{label}</Button>;
}
