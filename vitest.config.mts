import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://kondo:kondo_password@localhost:5432/kondo_module3_test";

export default defineConfig({
  test: {
    fileParallelism: false,
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
