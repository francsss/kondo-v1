import { describe, expect, it } from "vitest";
import { assertDestructiveSeedAllowed } from "@/lib/seed-safety";

describe("destructive seed guard", () => {
  it("requires explicit local/demo opt-in", () => {
    expect(() =>
      assertDestructiveSeedAllowed({
        NODE_ENV: "development",
        VERCEL_ENV: "preview",
        KONDO_ALLOW_DESTRUCTIVE_SEED: undefined,
      }),
    ).toThrow(/KONDO_ALLOW_DESTRUCTIVE_SEED=true/);
  });

  it("allows an explicitly opted-in non-production reset", () => {
    expect(() =>
      assertDestructiveSeedAllowed({
        NODE_ENV: "development",
        VERCEL_ENV: "preview",
        KONDO_ALLOW_DESTRUCTIVE_SEED: "true",
      }),
    ).not.toThrow();
  });

  it.each([
    { NODE_ENV: "production", VERCEL_ENV: undefined },
    { NODE_ENV: "development", VERCEL_ENV: "production" },
    { NODE_ENV: "production", VERCEL_ENV: "production" },
  ])("always blocks production even with opt-in: %o", (environment) => {
    expect(() =>
      assertDestructiveSeedAllowed({
        ...environment,
        KONDO_ALLOW_DESTRUCTIVE_SEED: "true",
      }),
    ).toThrow(/production environments can never be seeded/);
  });
});
