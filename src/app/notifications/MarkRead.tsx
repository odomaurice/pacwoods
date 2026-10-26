"use client";

import { useEffect } from "react";
import { markAllReadAction } from "@/actions/notifications";

/** Opening the notifications page counts as reading them. */
export default function MarkRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread > 0) void markAllReadAction();
  }, [unread]);
  return null;
}
