import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  RatelimitCtor: vi.fn(),
  slidingWindow: vi.fn((limit: number, window: string) => ({ limit, window })),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(function RedisMock() {
    return {};
  }),
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(function RatelimitMock(config) {
      mocks.RatelimitCtor(config);
      return { limit: mocks.limit };
    }),
    { slidingWindow: mocks.slidingWindow },
  ),
}));

const ORIGINAL_ENV = { ...process.env };

describe("rateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("falls back to an in-memory limiter when Redis env vars are absent", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = `memory-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i += 1) {
      await expect(rateLimit(key, 3, 60_000)).resolves.toMatchObject({
        allowed: true,
      });
    }
    await expect(rateLimit(key, 3, 60_000)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
    expect(mocks.RatelimitCtor).not.toHaveBeenCalled();
  });

  it("resets the in-memory window after it elapses", async () => {
    vi.useFakeTimers();
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = `memory-window-${crypto.randomUUID()}`;
    await expect(rateLimit(key, 1, 1_000)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(rateLimit(key, 1, 1_000)).resolves.toMatchObject({
      allowed: false,
    });
    vi.advanceTimersByTime(1_001);
    await expect(rateLimit(key, 1, 1_000)).resolves.toMatchObject({
      allowed: true,
    });
    vi.useRealTimers();
  });

  it("uses Upstash Redis when configured and reuses one limiter per limit/window pair", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    mocks.limit.mockResolvedValue({ success: true, remaining: 4, reset: 12345 });
    const { rateLimit } = await import("@/lib/rate-limit");

    await expect(rateLimit("redis-key-a", 5, 60_000)).resolves.toEqual({
      allowed: true,
      remaining: 4,
      resetAt: 12345,
    });
    await rateLimit("redis-key-b", 5, 60_000);
    expect(mocks.RatelimitCtor).toHaveBeenCalledTimes(1);
    expect(mocks.limit).toHaveBeenCalledTimes(2);
    expect(mocks.limit).toHaveBeenNthCalledWith(1, "redis-key-a");
    expect(mocks.limit).toHaveBeenNthCalledWith(2, "redis-key-b");
  });

  it("fails over to the in-memory limiter if Redis throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    mocks.limit.mockRejectedValue(new Error("upstash unavailable"));
    const { rateLimit } = await import("@/lib/rate-limit");

    await expect(
      rateLimit(`redis-failover-${crypto.randomUUID()}`, 5, 60_000),
    ).resolves.toMatchObject({ allowed: true });
  });
});
