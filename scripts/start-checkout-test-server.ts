import { spawn } from "node:child_process";
import { checkoutTestUrl } from "../tests/checkout-database.ts";
import { authTestSecret } from "../tests/auth-database.ts";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3004",
  ],
  {
    env: {
      ...process.env,
      DATABASE_URL: checkoutTestUrl(),
      NEXTAUTH_SECRET: authTestSecret(),
      NEXTAUTH_URL: "http://localhost:3004",
      PAYMENT_PROVIDER: "simulated",
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
