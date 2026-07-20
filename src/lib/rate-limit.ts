import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logServerError } from "@/lib/logger";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  current.count += 1;
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

let redisClient: Redis | null | undefined;

// Returns null (and every call falls back to the single-process in-memory
// limiter above) until UPSTASH_REDIS_REST_URL/TOKEN are configured. This lets
// the app run and pass its full test suite with no Redis instance at all,
// while being ready for shared multi-instance limits once those envs exist.
function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

const limiters = new Map<string, Ratelimit>();

function getLimiter(redis: Redis, limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  const existing = limiters.get(cacheKey);
  if (existing) return existing;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false,
    prefix: "kondo-rate-limit",
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

export async function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  if (!redis) return memoryRateLimit(key, limit, windowMs);
  try {
    const result = await getLimiter(redis, limit, windowMs).limit(key);
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  } catch (error) {
    // Fail over to the in-memory limiter rather than letting a transient
    // Redis outage either block all traffic or remove rate limiting outright.
    logServerError("rate-limit.redis", error);
    return memoryRateLimit(key, limit, windowMs);
  }
}
