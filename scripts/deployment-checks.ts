import { spawn } from "node:child_process";
import {
  deploymentDatabase,
  deploymentEnvironment,
} from "../tests/deployment-database.ts";
const env: NodeJS.ProcessEnv = deploymentEnvironment();
async function run(args: string[], extra: Partial<NodeJS.ProcessEnv> = {}) {
  const child = spawn(process.execPath, args, {
    env: { ...env, ...extra },
    stdio: "inherit",
  });
  const stop = () => child.kill();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error("Verificación local no exitosa.")),
      );
    });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
const tsx = "node_modules/tsx/dist/cli.mjs";
const mode = process.argv[2];
if (mode !== "prepare") {
  // Incluso un cliente creado sin parámetro explícito permanece fuera de la base habitual.
  env.DATABASE_URL = deploymentDatabase("base");
  env.DIRECT_URL = deploymentDatabase("base");
}
if (mode === "prepare") {
  for (const kind of ["base", "auth", "checkout", "analytics"] as const)
    await run([tsx, "scripts/prepare-auth-tests.ts"], {
      AUTH_TEST_DATABASE_URL: deploymentDatabase(kind),
    });
  for (const kind of ["catalog", "bootstrap"] as const)
    await run([tsx, "scripts/prepare-test-db.ts"], {
      TEST_DATABASE_URL: deploymentDatabase(kind),
    });
} else if (mode === "integration")
  await run([
    tsx,
    "--test",
    "tests/deployment.integration.test.ts",
    "tests/analytics.integration.test.ts",
    "tests/auth.integration.test.ts",
    "tests/checkout.integration.test.ts",
    "tests/catalog.integration.test.ts",
  ]);
else if (mode === "browser")
  await run(["node_modules/@playwright/test/cli.js", "test"]);
else if (mode === "http")
  await run([
    tsx,
    "--test",
    "tests/auth.http.test.ts",
    "tests/checkout.http.test.ts",
    "tests/catalog.http.test.ts",
  ]);
else if (mode === "observability")
  await run([tsx, "scripts/check-observability.ts"]);
else if (mode === "restart")
  await run([tsx, "scripts/check-checkout-restart.ts"]);
else if (mode === "start-base")
  await run(
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000",
    ],
    { DATABASE_URL: deploymentDatabase("base") },
  );
else if (mode === "start-auth")
  await run([tsx, "scripts/start-auth-test-server.ts"]);
else if (mode === "start-checkout")
  await run([tsx, "scripts/start-checkout-test-server.ts"]);
else if (mode === "start-analytics")
  await run([tsx, "scripts/start-analytics-test-server.ts"]);
else
  throw new Error(
    "Modo: prepare|integration|browser|http|observability|restart|start-base|start-auth|start-checkout|start-analytics.",
  );
