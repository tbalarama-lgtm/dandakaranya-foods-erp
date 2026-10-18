import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000
  },
  resolve: {
    alias: {
      "@shared": resolve("src/shared")
    }
  }
});
