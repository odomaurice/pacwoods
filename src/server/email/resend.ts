import "server-only";

/**
 * Sends email through Resend's HTTP API (no SDK needed).
 *
 *   RESEND_API_KEY  re_…            required to send at all
 *   EMAIL_FROM      "Pacwoods <no-reply@your-domain>"  must be a domain verified
 *                   in Resend; until then Resend's onboarding@resend.dev only
 *                   delivers to the Resend account's own address.
 */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(message: { to: string; subject: string; html: string; text: string }) {
  if (!emailConfigured()) {
    console.warn(`[email] RESEND_API_KEY is not set; not sending "${message.subject}".`);
    return { sent: false as const };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Pacwoods <onboarding@resend.dev>",
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!res.ok) {
    // Never log the recipient's full address or the message body.
    console.error(`[email] Resend refused the message: ${res.status} ${await res.text().catch(() => "")}`);
    return { sent: false as const };
  }
  return { sent: true as const };
}
