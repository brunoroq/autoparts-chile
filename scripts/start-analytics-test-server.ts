import { spawn } from "node:child_process";
import { analyticsTestUrl } from "../tests/analytics-database.ts";
import { authTestSecret } from "../tests/auth-database.ts";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3005",
  ],
  {
    env: {
      ...process.env,
      DATABASE_URL: analyticsTestUrl(),
      NEXTAUTH_SECRET: authTestSecret(),
      NEXTAUTH_URL: "http://localhost:3005",
      PAYMENT_PROVIDER: "simulated",
      ANALYTICS_ENABLED: "true",
      GA4_MEASUREMENT_ID: "G-TEST12345",
      GA4_DEBUG: "true",
      WEB_VITALS_ENABLED: "true",
      RESOURCE_METRICS_ENABLED: "true",
      RESOURCE_SAMPLE_MS: "5000",
      TRAFFIC_KIND: "human",
      EXPERIMENT_ID: "analytics-validation",
      WEBPAY_ENVIRONMENT: "integration",
    },
    stdio: "inherit",
  },
);
process.on("SIGINT", () => server.kill());
process.on("SIGTERM", () => server.kill());
server.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
