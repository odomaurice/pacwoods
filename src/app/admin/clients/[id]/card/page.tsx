import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { LogoMark } from "@/components/Logo";
import PrintButton from "@/components/PrintButton";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { getClient } from "@/server/services/users";

export const metadata: Metadata = { title: "Client card | Pacwoods" };

/**
 * Printable client card. The QR encodes only the client number, which is
 * printed on the card anyway; it identifies the client at the counter and
 * grants no access by itself.
 */
export default async function ClientCardPage({ params }: PageProps<"/admin/clients/[id]/card">) {
  await requireRole("SUPER_ADMIN", "ADMIN");
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const { profile, user } = client;
  const qr = await QRCode.toString(profile.clientNumber, { type: "svg", margin: 0, errorCorrectionLevel: "M" });

  return (
    <div className="space-y-6">
      <div className="flex gap-2 print:hidden">
        <Link href={`/admin/clients/${id}`} className={buttonVariants({ variant: "outline" })}>
          Back
        </Link>
        <PrintButton />
      </div>

      {/* 85.6 × 54 mm: a standard ID-1 card. */}
      <article className="flex h-[54mm] w-[85.6mm] overflow-hidden rounded-lg bg-brand-charcoal text-white print:rounded-none">
        <div className="flex flex-1 flex-col justify-between p-[4mm]">
          <div className="flex items-center gap-1.5 text-[11pt] font-extrabold tracking-tight">
            <LogoMark className="h-[7mm] w-auto" />
            <span>
              Pa<span className="text-brand-gold">C</span> WOODS
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10pt] leading-tight font-semibold">{profile.businessName ?? user.name}</p>
            {profile.businessName && <p className="text-[8pt] text-white/80">{user.name}</p>}
            <p className="text-[8pt] text-white/80">{user.phone ?? user.email}</p>
          </div>
          <p className="font-mono text-[11pt] font-semibold text-brand-gold">{profile.clientNumber}</p>
        </div>
        <div className="flex items-center bg-white p-[3mm]">
          <div
            className="size-[26mm] text-brand-charcoal [&_svg]:size-full"
            role="img"
            aria-label={`QR code for ${profile.clientNumber}`}
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        </div>
      </article>
    </div>
  );
}
