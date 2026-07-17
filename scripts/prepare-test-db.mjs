import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const localTestDatabaseUrl =
  "postgresql://kondo:kondo_password@localhost:5432/kondo_module3_test";
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl;

async function ensureLocalTestDatabase() {
  if (process.env.TEST_DATABASE_URL) return;

  const admin = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://kondo:kondo_password@localhost:5432/kondo",
      },
    },
  });
  try {
    const rows = await admin.$queryRawUnsafe(
      "SELECT 1 FROM pg_database WHERE datname = 'kondo_module3_test'",
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      await admin.$executeRawUnsafe('CREATE DATABASE "kondo_module3_test"');
    }
  } finally {
    await admin.$disconnect();
  }
}

await ensureLocalTestDatabase();
execFileSync("npx", ["prisma", "migrate", "deploy"], {
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  stdio: "inherit",
});
