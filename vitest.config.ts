import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests des calculs (recherche, validite) : sans navigateur, sans la config Lovable.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
