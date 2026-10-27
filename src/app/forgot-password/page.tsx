import type { Metadata } from "next";
import AuthFrame from "@/components/AuthFrame";
import ForgotForm from "./ForgotForm";

export const metadata: Metadata = { title: "Forgot password | Pacwoods" };

export default function ForgotPasswordPage() {
  return (
    <AuthFrame title="Forgot your password?" description="Enter the email address on your Pacwoods account and we will send you a link to choose a new one.">
      <ForgotForm />
    </AuthFrame>
  );
}
