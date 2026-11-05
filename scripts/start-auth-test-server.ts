import { spawn } from "node:child_process";
import { authTestSecret, authTestUrl } from "../tests/auth-database.ts";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3002",
  ],
  {
    env: {
      ...process.env,
      DATABASE_URL: authTestUrl(),
      NEXTAUTH_SECRET: authTestSecret(),
      NEXTAUTH_URL: "http://localhost:3002",
    },
    stdio: "inherit",
  },
);
process.on("SIGINT", () => server.kill());
process.on("SIGTERM", () => server.kill());
server.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
