import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node environment: current tests cover pure server/shared logic. Switch to
    // 'jsdom' and add setup files here when React component tests are introduced.
    environment: "node",
    include: ["server/**/*.test.ts", "client/**/*.test.ts", "shared/**/*.test.ts"],
  },
});
