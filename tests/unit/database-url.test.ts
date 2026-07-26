import { describe, expect, it } from "vitest";
import {
  normalizePrismaEnvironment,
  prismaCompatibleDatabaseUrl,
} from "@/lib/database-url";

describe("Prisma database URL compatibility", () => {
  it("removes only the unsupported channel binding parameter", () => {
    const normalized = prismaCompatibleDatabaseUrl(
      "postgresql://user:password@example.test/db?sslmode=require&channel_binding=require&schema=public",
    );
    const url = new URL(normalized!);
    expect(url.searchParams.get("channel_binding")).toBeNull();
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("schema")).toBe("public");
  });

  it("normalizes both pooled and direct URLs without logging secrets", () => {
    const environment = {
      DATABASE_URL:
        "postgresql://user:secret@pooler.example.test/db?sslmode=require&channel_binding=require",
      DIRECT_URL:
        "postgresql://user:secret@direct.example.test/db?sslmode=require&channel_binding=require",
    } as unknown as NodeJS.ProcessEnv;
    normalizePrismaEnvironment(environment);
    expect(environment.DATABASE_URL).not.toContain("channel_binding");
    expect(environment.DIRECT_URL).not.toContain("channel_binding");
    expect(environment.DATABASE_URL).toContain("sslmode=require");
  });
});
