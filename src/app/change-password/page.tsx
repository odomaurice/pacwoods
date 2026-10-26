import type { Metadata } from "next";
import AuthFrame from "@/components/AuthFrame";
import { requireUser } from "@/server/auth/guards";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata: Metadata = { title: "Change password | Pacwoods" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPendingPasswordChange: true });

  return (
    <AuthFrame
      title={user.mustChangePassword ? "Choose your own password" : "Change password"}
      description={
        user.mustChangePassword
          ? "You signed in with a temporary password. Replace it before continuing."
          : "Enter your current password, then the new one twice."
      }
    >
      <ChangePasswordForm temporary={user.mustChangePassword} />
    </AuthFrame>
  );
}
