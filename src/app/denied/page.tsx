import type { Metadata } from "next";
import MessagePage from "@/components/MessagePage";

export const metadata: Metadata = { title: "Access denied | Pacwoods" };

export default function DeniedPage() {
  return (
    <MessagePage title="You do not have access to that page">
      Your account cannot open this area. If you think it should, ask a Pacwoods administrator.
    </MessagePage>
  );
}
