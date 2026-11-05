import { execFileSync } from "node:child_process";
import { analyticsTestUrl } from "../tests/analytics-database.ts";
execFileSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "scripts/prepare-auth-tests.ts"],
  {
    env: { ...process.env, AUTH_TEST_DATABASE_URL: analyticsTestUrl() },
    stdio: "inherit",
  },
);
