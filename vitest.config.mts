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
    // `.tsx` is allowed so component tests can render with JSX instead of
    // `createElement` calls that pass children as a prop.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
