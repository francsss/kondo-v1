import { describe, expect, it } from "vitest";
import {
  assertProductionEnvironment,
  ProductionEnvironmentError,
  productionEnvironmentIssues,
} from "@/lib/environment";
import { getJwtSecret } from "@/lib/runtime-secrets";

const validProductionEnvironment = {
  DATABASE_URL:
    "postgresql://app:secret@ep-kondo-pooler.us-east-2.aws.neon.tech/kondo?sslmode=require",
  DIRECT_URL:
    "postgresql://app:secret@ep-kondo.us-east-2.aws.neon.tech/kondo?sslmode=require",
  JWT_SECRET: "jwt-secret-that-is-at-least-thirty-two-bytes-long",
  NEXT_PUBLIC_APP_URL: "https://kondo.app",
  STORAGE_DRIVER: "s3",
  STORAGE_BUCKET: "kondo-production",
  STORAGE_REGION: "auto",
  STORAGE_ENDPOINT: "https://0123456789abcdef.r2.cloudflarestorage.com",
  STORAGE_ACCESS_KEY_ID: "r2-access-key-long",
  STORAGE_SECRET_ACCESS_KEY: "r2-secret-key-that-is-more-than-32-bytes",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_production_key_long",
  EMAIL_FROM: "Kondo <no-reply@kondo.app>",
  UPSTASH_REDIS_REST_URL: "https://kondo.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "upstash-token-long-enough",
  CRON_SECRET: "cron-secret-that-is-at-least-thirty-two-bytes",
  OPENAI_API_KEY: "sk-project-test-key-long-enough",
};

describe("production environment validation", () => {
  it("accepts a complete production configuration", () => {
    expect(productionEnvironmentIssues(validProductionEnvironment)).toEqual([]);
    expect(() =>
      assertProductionEnvironment(validProductionEnvironment),
    ).not.toThrow();
  });

  it("reports every missing or unsafe production value together", () => {
    expect(() =>
      assertProductionEnvironment({
        JWT_SECRET: "short",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000/path",
        STORAGE_DRIVER: "local",
        EMAIL_PROVIDER: "console",
        KONDO_ALLOW_DESTRUCTIVE_SEED: "true",
      }),
    ).toThrow(ProductionEnvironmentError);
    const issues = productionEnvironmentIssues({
      JWT_SECRET: "short",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000/path",
      STORAGE_DRIVER: "local",
      EMAIL_PROVIDER: "console",
      KONDO_ALLOW_DESTRUCTIVE_SEED: "true",
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        "DATABASE_URL is required.",
        "JWT_SECRET must contain at least 32 bytes.",
        'STORAGE_DRIVER must be "s3" in production.',
        'EMAIL_PROVIDER must be "resend" in production.',
        "KONDO_ALLOW_DESTRUCTIVE_SEED must not be enabled.",
      ]),
    );
  });

  it("rejects weak configured JWT secrets before signing", () => {
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "too-short";
    try {
      expect(() => getJwtSecret()).toThrow(
        "JWT_SECRET must contain at least 32 bytes.",
      );
    } finally {
      if (previous === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previous;
    }
  });
});
