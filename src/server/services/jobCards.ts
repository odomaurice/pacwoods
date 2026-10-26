import "server-only";
import { headers } from "next/headers";
import type { JobCardData } from "@/components/JobCard";
import { connectDb } from "@/server/db/connect";
import { ClientProfile } from "@/server/db/models/ClientProfile";
import { Job } from "@/server/db/models/Job";
import { User } from "@/server/db/models/User";
import { getCutlists } from "@/server/services/cutlists";

/**
 * Everything a job card shows. Clients get the approved cutlist only once
 * it exists; staff also see a draft. `ownerUserId` restricts the lookup to
 * one client's jobs, so a client can never load someone else's card.
 */
export async function getJobCardData(workNumber: string, opts: { ownerUserId?: string } = {}) {
  await connectDb();
  const job = await Job.findOne({ workNumber }).lean();
  if (!job) return null;
  const profile = await ClientProfile.findById(job.clientId).lean();
  if (!profile) return null;
  if (opts.ownerUserId && profile.userId.toString() !== opts.ownerUserId) return null;
  const user = await User.findById(profile.userId).select("name phone email").lean();

  const { draft, approved } = await getCutlists(job._id);
  const chosen = job.status === "DRAFT" ? (draft ?? approved) : (approved ?? draft);

  const data: JobCardData = {
    workNumber: job.workNumber,
    status: job.status,
    createdAt: job.createdAt,
    title: job.title,
    operations: job.operations ?? { cutting: true, edging: false },
    clientNotes: job.clientNotes,
    internalNotes: opts.ownerUserId ? undefined : job.internalNotes,
    client: {
      name: user?.name ?? "",
      businessName: profile.businessName,
      clientNumber: profile.clientNumber,
      contact: user?.phone ?? user?.email,
    },
    cutlist: chosen
      ? {
          version: chosen.version,
          approved: chosen.state === "APPROVED",
          parts: chosen.parts,
          stockSheets: chosen.stockSheets,
          plan: chosen.plan,
        }
      : null,
  };
  return { data, qrToken: job.qrToken };
}

/** Absolute URL a scanned QR code opens. */
export async function scanUrl(qrToken: string) {
  const configured = process.env.AUTH_URL?.replace(/\/$/, "");
  if (configured) return `${configured}/j/${qrToken}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/j/${qrToken}`;
}
