import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src") } },
  test: {
    environment: "node",
    env: { DATABASE_PATH: ":memory:", SEED_DEMO_DATA: "false", TZ: "UTC" },
  },
});
