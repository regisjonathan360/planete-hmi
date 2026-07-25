import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "./src/__mocks__/server-only.ts"),
      "@/": path.resolve(__dirname, "./src/") + "/",
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
