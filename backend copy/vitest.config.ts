import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest (via Vite) doesn't read tsconfig "paths" automatically — without
// this, every `@/...` import in a test file would fail to resolve, and
// `npm test` would fail before a single assertion ran.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Coverage-threshold follow-up: this is a FLOOR, not a target — set
      // deliberately low because coverage today is uneven (strong on
      // auth/payments per the payment-webhook fraud fix, thin on the
      // newer service-tile domains) and this sandbox has never run these
      // tests against a live Postgres/Redis to know the real number.
      // Its only job is to stop coverage from silently dropping further;
      // ratchet these up in small steps as real tests get added; do NOT
      // raise them without first confirming `npm run test:coverage`
      // actually clears the new number on a real database.
      thresholds: {
        lines: 20,
        statements: 20,
        functions: 20,
        branches: 15,
      },
    },
  },
});
