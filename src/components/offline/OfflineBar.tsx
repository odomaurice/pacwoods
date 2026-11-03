"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { CloudUploadIcon, Wifi01Icon, WifiDisconnected01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acknowledgeBack, connectivity, connectivityOnServer, subscribeConnectivity } from "@/lib/offline/connectivity";
import { outboxItems, outboxItemsOnServer, startOutbox, subscribeOutbox } from "@/lib/offline/outbox";
import { cn } from "@/lib/utils";

/**
 * The signed-in user's connection state, at the top of every app screen:
 * offline (and what still works), changes waiting to be sent, and back
 * online with a refresh. Also runs the outbox for this user.
 */
export default function OfflineBar({ userId }: { userId: string }) {
  const router = useRouter();
  const status = useSyncExternalStore(subscribeConnectivity, connectivity, connectivityOnServer);
  const waiting = useSyncExternalStore(subscribeOutbox, outboxItems, outboxItemsOnServer);

  useEffect(
    () =>
      startOutbox(userId, ({ sent, rejected }) => {
        if (sent) toast.success(sent === 1 ? "1 saved change was sent." : `${sent} saved changes were sent.`);
        for (const message of rejected) toast.error(message);
        acknowledgeBack();
        router.refresh();
      }),
    [userId, router],
  );

  const pending = waiting.length;
  const saved = pending === 1 ? "1 change is saved on this device" : `${pending} changes are saved on this device`;
  if (status === "online" && pending === 0) return null;

  const offline = status === "offline";
  return (
    <div
      role="status"
      className={cn(
        "mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3 text-sm",
        offline ? "bg-brand-charcoal text-white" : "bg-card shadow-sm ring-1 ring-foreground/10",
      )}
    >
      <HugeiconsIcon icon={offline ? WifiDisconnected01Icon : pending ? CloudUploadIcon : Wifi01Icon} className={cn("size-5 shrink-0", offline && "text-brand-gold")} />
      <p className="min-w-0 flex-1">
        {offline ? (
          <>
            <span className="font-semibold">You&rsquo;re offline.</span> This is the last saved copy of the page. Ticking cuts and taking photos still work
            {pending ? `; ${saved} and will be sent when you’re back online.` : " and are sent when you’re back online."} Starting jobs, approving and payments need a
            connection.
          </>
        ) : pending ? (
          <>
            <span className="font-semibold">Sending…</span> {saved}.
          </>
        ) : (
          <>
            <span className="font-semibold">You&rsquo;re back online.</span> Refresh to see the latest.
          </>
        )}
      </p>
      {status === "back" && !pending && (
        <Button
          size="sm"
          onClick={() => {
            acknowledgeBack();
            router.refresh();
          }}
        >
          Refresh
        </Button>
      )}
    </div>
  );
}
