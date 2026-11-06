import { spawn } from "node:child_process";
import { authTestSecret, authTestUrl } from "../tests/auth-database.ts";
const port = process.argv[2] === "guest" ? "3012" : "3002";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    env: {
      ...process.env,
      DATABASE_URL: authTestUrl(),
      NEXTAUTH_SECRET: authTestSecret(),
      NEXTAUTH_URL: `http://localhost:${port}`,
    },
    stdio: "inherit",
  },
);
process.on("SIGINT", () => server.kill());
process.on("SIGTERM", () => server.kill());
server.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
