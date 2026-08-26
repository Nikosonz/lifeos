import type { EmailProvider } from "../ports/email-provider";
import { logger } from "../../logging/logger";

// Injectable purely so the unit test can drive this without a network call
// or a real API key. Production always gets the global fetch.
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Resend caps a request at 30s on its side; this bounds the wait from ours
// so a hung connection surfaces as an error the user can retry rather than
// holding the request open until the platform kills it.
const TIMEOUT_MS = 10_000;

function otpEmail(code: string): { subject: string; html: string; text: string } {
  // Farsi, RTL, and deliberately plain: an OTP mail that renders as a wall
  // of images or webfonts is the kind that lands in spam. The code is
  // repeated in the plain-text part because some Iranian webmail clients
  // strip HTML entirely.
  const subject = `کد ورود شما به مال تو: ${code}`;
  const html = `<!doctype html>
<html dir="rtl" lang="fa">
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:Tahoma,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;text-align:right;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">مال تو</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.9;">
        برای ورود به حساب خود، کد زیر را وارد کنید:
      </p>
      <p style="margin:0 0 24px;font-size:32px;font-weight:bold;letter-spacing:6px;color:#1a1a2e;text-align:center;direction:ltr;">
        ${code}
      </p>
      <p style="margin:0;font-size:13px;color:#777;line-height:1.9;">
        این کد تا ۵ دقیقه معتبر است. اگر شما درخواست ورود نداده‌اید، این ایمیل را نادیده بگیرید.
      </p>
    </div>
  </body>
</html>`;
  const text = [
    "مال تو",
    "",
    `کد ورود شما: ${code}`,
    "",
    "این کد تا ۵ دقیقه معتبر است.",
    "اگر شما درخواست ورود نداده‌اید، این ایمیل را نادیده بگیرید.",
  ].join("\n");

  return { subject, html, text };
}

/**
 * Real OTP delivery over Resend's REST API.
 *
 * **A failed send throws.** That is the whole contract: this method's only
 * job is to put a code in front of a user, so returning normally when the
 * send failed would leave them staring at a code-entry box waiting for an
 * email that is never coming, while the API reported 200 and the OTP row
 * sits in Postgres looking perfectly healthy. The route turns the throw
 * into an error the client shows, and the user can retry.
 *
 * Uses `fetch` directly rather than the `resend` npm package: one endpoint,
 * one JSON body, and this repo's registry access is unreliable enough
 * (see CLAUDE.md's Environment Constraints) that not adding a dependency
 * for ~30 lines is worth it on its own.
 */
export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async sendOtp(email: string, code: string): Promise<void> {
    const { subject, html, text } = otpEmail(code);

    let response: Response;
    try {
      response = await this.fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: this.from, to: [email], subject, html, text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (cause) {
      // Network failure or timeout. The code is never logged here — the
      // whole point of a real provider is that the code exists only in the
      // user's inbox.
      logger.error(
        { event: "email.send_failed", provider: "resend", reason: "network" },
        "Resend request failed before a response was received",
      );
      throw new Error("Failed to send the login email", { cause });
    }

    if (!response.ok) {
      // Resend returns a JSON body with `message` on failure; read it for
      // the log only. It routinely names the exact misconfiguration
      // ("domain is not verified", "invalid from address"), which is the
      // difference between a five-minute fix and an afternoon.
      const detail = await response.text().catch(() => "");
      logger.error(
        {
          event: "email.send_failed",
          provider: "resend",
          status: response.status,
          detail: detail.slice(0, 500),
        },
        "Resend rejected the message",
      );
      throw new Error(`Failed to send the login email (Resend returned ${response.status})`);
    }

    logger.info({ event: "email.sent", provider: "resend" }, "OTP email sent");
  }
}
