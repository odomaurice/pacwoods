import { z } from "zod";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const signInSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your phone number or email."),
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX),
});

export type SignInInput = z.infer<typeof signInSchema>;
