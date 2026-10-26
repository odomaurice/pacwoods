import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthFrame from "@/components/AuthFrame";
import { getSessionUser } from "@/server/auth/guards";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in | Pacwoods" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");

  return (
    <AuthFrame
      title="Sign in"
      description="Use the phone number or email and the password Pacwoods gave you."
    >
      <LoginForm />
    </AuthFrame>
  );
}
