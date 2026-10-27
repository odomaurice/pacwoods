import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { requireRole } from "@/server/auth/guards";
import { getSettings } from "@/server/services/settings";
import SettingsForm from "./SettingsForm";

export const metadata: Metadata = { title: "Settings | Pacwoods" };

export default async function SettingsPage() {
  await requireRole("SUPER_ADMIN");
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Workshop defaults and machine figures. Changes are recorded in the audit log." />
      <SettingsForm initial={settings} />
    </>
  );
}
