import type { ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Layers01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { TaskStatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { eventLabel } from "@/lib/events";
import { ISSUE_CATEGORY_LABELS, type IssueCategory } from "@/lib/issues";
import { STAGE_LABELS, type Stage, type TaskStatus } from "@/lib/production";

const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function when(d: Date) {
  return new Date().toDateString() === d.toDateString() ? time.format(d) : `${day.format(d)} ${time.format(d)}`;
}

/** Charcoal welcome band with the day's headline numbers. */
export function CommandHeader({
  name,
  figures,
  actions,
  timeZone = "UTC",
}: {
  name: string;
  figures: Array<{ label: string; value: number; href: string; alert?: boolean }>;
  actions: ReactNode;
  timeZone?: string;
}) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <section className="overflow-hidden rounded-xl bg-brand-charcoal text-white">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-brand-gold uppercase">
            {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone }).format(new Date())}
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            {greeting}, {name.split(" ")[0]}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      <dl className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-3 xl:grid-cols-6">
        {figures.map((f) => (
          <Link key={f.label} href={f.href} className="group border-white/10 p-4 hover:bg-white/5 sm:p-5 [&:not(:last-child)]:border-r">
            <dt className="text-xs text-white/70">{f.label}</dt>
            <dd className={`text-3xl font-semibold tabular-nums ${f.alert && f.value > 0 ? "text-brand-gold" : "text-white"}`}>{f.value}</dd>
          </Link>
        ))}
      </dl>
    </section>
  );
}

type Attention = {
  unassigned: Array<{ id: string; workNumber: string; stage: Stage; queued: boolean }>;
  issues: Array<{ id: string; workNumber: string; category: IssueCategory; reporterRole: string; at: Date }>;
  awaitingMaterial: Array<{ workNumber: string; title?: string | null; since: Date }>;
};

function Group({ icon, title, count, href, empty, children }: { icon: typeof Alert02Icon; title: string; count: number; href: string; empty: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={icon} className="size-5 text-brand-gold-deep" />
        <h3 className="font-medium">{title}</h3>
        <span className={`rounded-full px-2 text-xs font-semibold tabular-nums ${count ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{count}</span>
        <Link href={href} className="ml-auto text-sm text-muted-foreground hover:text-foreground hover:underline">
          See all
        </Link>
      </div>
      {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y divide-border">{children}</ul>}
    </div>
  );
}

function Row({ main, sub, href, cta }: { main: ReactNode; sub: ReactNode; href: string; cta: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{main}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <Link href={href} className={buttonVariants({ size: "sm", variant: "outline" })}>
        {cta}
      </Link>
    </li>
  );
}

/** Everything that needs a person to act, with the button that does it. */
export function NeedsAttention({ data, counts }: { data: Attention; counts: { unassigned: number; issues: number; awaitingMaterial: number } }) {
  return (
    <section aria-labelledby="attention" className="space-y-5 rounded-lg bg-card p-5">
      <h2 id="attention" className="text-lg font-semibold">
        Needs attention
      </h2>
      <Group icon={UserAdd01Icon} title="Waiting to be taken" count={counts.unassigned} href="/admin/queues" empty="Every ready job has been taken.">
        {data.unassigned.map((t) => (
          <Row
            key={t.id}
            main={<span className="font-mono">{t.workNumber}</span>}
            sub={`${STAGE_LABELS[t.stage]} · ${t.queued ? "in the queue now" : "not queued yet"}`}
            href={`/admin/tasks/${t.id}`}
            cta="Assign"
          />
        ))}
      </Group>
      <Group icon={Alert02Icon} title="Open issues" count={counts.issues} href="/admin/issues" empty="No open issues.">
        {data.issues.map((i) => (
          <Row
            key={i.id}
            main={
              <>
                <span className="font-mono">{i.workNumber}</span> · {ISSUE_CATEGORY_LABELS[i.category]}
              </>
            }
            sub={`From ${i.reporterRole === "CLIENT" ? "client" : "operator"} · ${when(i.at)}`}
            href={`/admin/issues/${i.id}`}
            cta="Resolve"
          />
        ))}
      </Group>
      <Group icon={Layers01Icon} title="Approved, waiting for materials" count={counts.awaitingMaterial} href="/admin/jobs?status=AWAITING_MATERIAL" empty="No approved job is waiting for materials.">
        {data.awaitingMaterial.map((j) => (
          <Row key={j.workNumber} main={<span className="font-mono">{j.workNumber}</span>} sub={`${j.title ? `${j.title} · ` : ""}since ${when(j.since)}`} href={`/admin/jobs/${j.workNumber}`} cta="Confirm" />
        ))}
      </Group>
    </section>
  );
}

type Snapshot = Array<{ id: string; workNumber: string; queueSeq?: number | null; status: TaskStatus; operator?: string }>;

/** The head of each production queue, as the floor sees it. */
export function QueueSnapshots({ cutting, cnc, edging }: { cutting: Snapshot; cnc: Snapshot; edging: Snapshot }) {
  const list = (title: string, rows: Snapshot) => (
    <div>
      <h3 className="mb-1 text-sm font-medium text-muted-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Empty.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/tasks/${t.id}`} className="flex items-center gap-3 py-2 text-sm hover:bg-muted/50">
                <span className="w-10 text-muted-foreground tabular-nums">#{t.queueSeq}</span>
                <span className="font-mono">{t.workNumber}</span>
                <span className="min-w-0 flex-1 truncate">{t.operator ?? <span className="text-destructive">No operator</span>}</span>
                <TaskStatusBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <section aria-labelledby="queues" className="space-y-4 rounded-lg bg-card p-5">
      <div className="flex items-center">
        <h2 id="queues" className="text-lg font-semibold">
          Queues now
        </h2>
        <Link href="/admin/queues" className="ml-auto text-sm text-muted-foreground hover:text-foreground hover:underline">
          Open queues
        </Link>
      </div>
      {list("Cutting", cutting)}
      {cnc.length > 0 && list("CNC machining", cnc)}
      {list("Edging", edging)}
    </section>
  );
}

export function ActivityFeed({ items }: { items: Array<{ id: string; at: Date; type: string; note?: string | null; workNumber?: string; actor?: string }> }) {
  return (
    <section aria-labelledby="activity" className="rounded-lg bg-card p-5">
      <h2 id="activity" className="mb-3 text-lg font-semibold">
        Recent activity
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="w-24 shrink-0 text-muted-foreground tabular-nums">{when(e.at)}</span>
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-gold" aria-hidden />
              <span className="min-w-0">
                <span className="font-medium">{eventLabel(e.type)}</span>
                {e.workNumber && (
                  <>
                    {" · "}
                    <Link href={`/admin/jobs/${e.workNumber}`} className="font-mono underline-offset-4 hover:underline">
                      {e.workNumber}
                    </Link>
                  </>
                )}
                <span className="block truncate text-muted-foreground">
                  {[e.actor, e.note].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
