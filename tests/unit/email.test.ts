import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function ResendMock() {
    return { emails: { send: mocks.send } };
  }),
}));

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("sendTransactionalEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: ORIGINAL_NODE_ENV };
  });

  it("no-ops outside production when no provider is configured", async () => {
    const { sendTransactionalEmail } = await import("@/lib/email");
    await expect(
      sendTransactionalEmail({ to: "a@example.com", subject: "s", text: "t" }),
    ).resolves.toBeUndefined();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("throws in production when no provider is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { sendTransactionalEmail, EmailDeliveryError } =
      await import("@/lib/email");
    await expect(
      sendTransactionalEmail({ to: "a@example.com", subject: "s", text: "t" }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);
    vi.unstubAllEnvs();
  });

  it("auto-selects Resend once RESEND_API_KEY is present and sends through it", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Kondo <hello@kondo.app>";
    mocks.send.mockResolvedValue({ data: { id: "email_1" }, error: null });
    const { sendTransactionalEmail } = await import("@/lib/email");

    await sendTransactionalEmail({
      to: "student@example.com",
      subject: "Verify your email",
      text: "Click here",
    });

    expect(mocks.send).toHaveBeenCalledWith({
      from: "Kondo <hello@kondo.app>",
      to: "student@example.com",
      subject: "Verify your email",
      text: "Click here",
    });
  });

  it("surfaces a Resend rejection as EmailDeliveryError", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Kondo <hello@kondo.app>";
    mocks.send.mockResolvedValue({
      data: null,
      error: { message: "Invalid from address" },
    });
    const { sendTransactionalEmail, EmailDeliveryError } =
      await import("@/lib/email");

    await expect(
      sendTransactionalEmail({ to: "a@example.com", subject: "s", text: "t" }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);
  });

  it("requires EMAIL_FROM even when RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const { sendTransactionalEmail, EmailDeliveryError } =
      await import("@/lib/email");
    await expect(
      sendTransactionalEmail({ to: "a@example.com", subject: "s", text: "t" }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects a missing recipient before checking the provider", async () => {
    const { sendTransactionalEmail, EmailDeliveryError } =
      await import("@/lib/email");
    await expect(
      sendTransactionalEmail({ to: "", subject: "s", text: "t" }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);
  });
});
