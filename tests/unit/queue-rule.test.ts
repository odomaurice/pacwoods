import { describe, expect, it } from "vitest";
import { eligibility, type QueueItem } from "@/lib/production";

const t = (id: string, status: QueueItem["status"], queueSeq: number | null, stage: QueueItem["stage"] = "CUTTING"): QueueItem => ({
  id,
  workNumber: `PAC-2026-00000${id}`,
  status,
  queueSeq,
  stage,
});

describe("queue rule", () => {
  it("allows only the earliest queued task", () => {
    const rules = eligibility([t("2", "QUEUED", 20), t("1", "QUEUED", 10), t("3", "QUEUED", 30)]);
    expect(rules.get("1")).toEqual({ canStart: true });
    expect(rules.get("2")?.canStart).toBe(false);
    expect(rules.get("2")?.reason).toContain("PAC-2026-000001");
    expect(rules.get("3")?.canStart).toBe(false);
  });

  it("blocks everything while one task is in progress", () => {
    const rules = eligibility([t("1", "IN_PROGRESS", 10), t("2", "QUEUED", 20), t("3", "QUEUED", 5, "EDGING")]);
    expect(rules.get("2")?.reason).toContain("Finish or pause PAC-2026-000001");
    expect(rules.get("3")?.canStart).toBe(false);
  });

  it("makes a paused task the one to resume before later ones", () => {
    const rules = eligibility([t("1", "PAUSED", 10), t("2", "QUEUED", 20)]);
    expect(rules.get("1")?.canStart).toBe(true);
    expect(rules.get("2")?.canStart).toBe(false);
  });

  it("keeps the two stages as separate queues", () => {
    const rules = eligibility([t("1", "QUEUED", 10), t("2", "QUEUED", 1, "EDGING")]);
    expect(rules.get("1")?.canStart).toBe(true);
    expect(rules.get("2")?.canStart).toBe(true);
  });

  it("explains edging that waits for cutting", () => {
    expect(eligibility([t("1", "BLOCKED", null, "EDGING")]).get("1")).toEqual({ canStart: false, reason: "Waiting for cutting to finish." });
  });
});
