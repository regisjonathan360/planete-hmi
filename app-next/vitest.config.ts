import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "./src/__mocks__/server-only.ts"),
    },
  },
  test: {
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
