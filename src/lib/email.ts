import { Resend } from "resend";

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
};

// EMAIL_PROVIDER can be set explicitly ("console" or "resend"). Left unset,
// it resolves to "resend" once RESEND_API_KEY exists and "console" otherwise,
// so the integration activates as soon as the required env vars are added
// without a separate provider-selection step.
function resolveProvider(): string {
  return process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "console");
}

let resendClient: Resend | null | undefined;

function getResendClient(): Resend | null {
  if (resendClient !== undefined) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  resendClient = apiKey ? new Resend(apiKey) : null;
  return resendClient;
}

/**
 * Provider-neutral transactional email boundary. Resolves to the Resend
 * provider once RESEND_API_KEY and EMAIL_FROM are configured; until then it
 * safely no-ops outside production so verification/reset flows remain fully
 * testable, and refuses to silently pretend delivery succeeded in production.
 */
export async function sendTransactionalEmail(
  email: TransactionalEmail,
): Promise<void> {
  if (!email.to) throw new EmailDeliveryError("Missing recipient address.");
  const provider = resolveProvider();

  if (provider === "console") {
    if (process.env.NODE_ENV === "production") {
      throw new EmailDeliveryError(
        "No transactional email provider is configured for production.",
      );
    }
    return;
  }

  if (provider === "resend") {
    const client = getResendClient();
    const from = process.env.EMAIL_FROM;
    if (!client || !from) {
      throw new EmailDeliveryError(
        "RESEND_API_KEY and EMAIL_FROM must both be set to use the resend provider.",
      );
    }
    const result = await client.emails.send({
      from,
      to: email.to,
      subject: email.subject,
      text: email.text,
    });
    if (result.error) {
      throw new EmailDeliveryError(
        result.error.message || "Resend rejected this email.",
      );
    }
    return;
  }

  throw new EmailDeliveryError(`Unsupported EMAIL_PROVIDER "${provider}".`);
}
