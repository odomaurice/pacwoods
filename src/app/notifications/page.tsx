import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/guards";
import { listNotifications } from "@/server/services/notifications";
import MarkRead from "./MarkRead";

export const metadata: Metadata = { title: "Notifications | Pacwoods" };

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <AppShell user={user}>
      <PageHeader title="Notifications" description={unread ? `${unread} new` : "You are up to date."} />
      <MarkRead unread={unread} />
      {items.length === 0 ? (
        <EmptyState title="No notifications yet." />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const body = (
              <>
                <span className="flex items-start gap-3">
                  {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-gold" aria-label="New" />}
                  <span className="min-w-0">
                    <span className="block font-medium">{n.title}</span>
                    {n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}
                    <span className="block text-xs text-muted-foreground">{when.format(n.createdAt)}</span>
                  </span>
                </span>
              </>
            );
            return (
              <li key={n._id.toString()}>
                {n.href ? (
                  <Link href={n.href} className={cn("block rounded-lg bg-card p-4 hover:bg-accent", !n.readAt && "ring-1 ring-brand-gold/40")}>
                    {body}
                  </Link>
                ) : (
                  <div className="rounded-lg bg-card p-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
