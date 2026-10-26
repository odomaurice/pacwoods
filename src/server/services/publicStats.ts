import "server-only";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { CutlistVersion } from "@/server/db/models/CutlistVersion";
import { Job } from "@/server/db/models/Job";

/** Shown only once there is enough history to be meaningful. */
const MIN_COMPLETED = 5;

/**
 * Headline figures for the public homepage, counted from real records.
 * Returns null on a young installation, so the page never shows zeros.
 */
export async function publicStats() {
  try {
    await connectDb();
    const completed = await Job.countDocuments({ status: "COMPLETED" });
    if (completed < MIN_COMPLETED) return null;
    const [clients, plans] = await Promise.all([
      ClientProfile.estimatedDocumentCount(),
      CutlistVersion.find({ state: "APPROVED" }).select("plan.totals.sheetsUsed plan.totals.sheetArea plan.totals.wasteArea").lean(),
    ]);
    const sheets = plans.reduce((n, p) => n + (p.plan?.totals.sheetsUsed ?? 0), 0);
    const area = plans.reduce((n, p) => n + (p.plan?.totals.sheetArea ?? 0), 0);
    const waste = plans.reduce((n, p) => n + (p.plan?.totals.wasteArea ?? 0), 0);
    return { completed, clients, sheets, utilisation: area ? (area - waste) / area : 0 };
  } catch {
    // The homepage must render even if the database is unreachable.
    return null;
  }
}
