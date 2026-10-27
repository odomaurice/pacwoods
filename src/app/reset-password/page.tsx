import type { Metadata } from "next";
import Link from "next/link";
import AuthFrame from "@/components/AuthFrame";
import { buttonVariants } from "@/components/ui/button";
import { resetTokenIsValid } from "@/server/services/passwordReset";
import ResetForm from "./ResetForm";

export const metadata: Metadata = { title: "Choose a new password | Pacwoods", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const valid = await resetTokenIsValid(value);

  return (
    <AuthFrame
      title={valid ? "Choose a new password" : "This link no longer works"}
      description={valid ? "Pick a password you have not used here before." : "Reset links work once and expire after 30 minutes."}
    >
      {valid ? (
        <ResetForm token={value} />
      ) : (
        <Link href="/forgot-password" className={buttonVariants({ className: "h-11 w-full" })}>
          Send me a new link
        </Link>
      )}
    </AuthFrame>
  );
}
