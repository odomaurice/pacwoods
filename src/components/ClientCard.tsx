import QRCode from "qrcode";
import { LogoMark } from "@/components/Logo";

/**
 * The client card, 85.6 × 54 mm (a standard ID-1 card). The QR encodes only
 * the client number, which is printed on the card anyway: it identifies the
 * client at the counter and grants no access by itself.
 */
export default async function ClientCard({
  clientNumber,
  name,
  businessName,
  contact,
}: {
  clientNumber: string;
  name: string;
  businessName?: string | null;
  contact?: string | null;
}) {
  const qr = await QRCode.toString(clientNumber, { type: "svg", margin: 0, errorCorrectionLevel: "M" });

  return (
    <article className="flex h-[54mm] w-[85.6mm] max-w-full overflow-hidden rounded-lg bg-brand-charcoal text-white print:rounded-none">
      <div className="flex min-w-0 flex-1 flex-col justify-between p-[4mm]">
        <div className="flex items-center gap-1.5 text-[11pt] font-extrabold tracking-tight">
          <LogoMark className="h-[7mm] w-auto" />
          <span>
            Pa<span className="text-brand-gold">C</span> WOODS
          </span>
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-[10pt] leading-tight font-semibold">{businessName ?? name}</p>
          {businessName && <p className="truncate text-[8pt] text-white/80">{name}</p>}
          {contact && <p className="truncate text-[8pt] text-white/80">{contact}</p>}
        </div>
        <p className="font-mono text-[11pt] font-semibold text-brand-gold">{clientNumber}</p>
      </div>
      <div className="flex items-center bg-white p-[3mm]">
        <div
          className="size-[26mm] text-brand-charcoal [&_svg]:size-full"
          role="img"
          aria-label={`QR code for ${clientNumber}`}
          dangerouslySetInnerHTML={{ __html: qr }}
        />
      </div>
    </article>
  );
}
