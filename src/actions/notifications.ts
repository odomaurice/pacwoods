"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/guards";
import { markAllRead } from "@/server/services/notifications";

export async function markAllReadAction() {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath("/", "layout");
}
