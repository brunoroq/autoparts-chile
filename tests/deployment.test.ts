import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { spawnSync } from "node:child_process";
test("configuración Prisma cloud inválida falla sin exponer la conexión", () => {
  const marker = "never-real-sensitive-connection";
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      "await import('./src/lib/db/prisma.ts')",
    ],
    {
      env: { ...process.env, VERCEL: "1", DATABASE_URL: marker },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_URL de Vercel inválida/);
  assert.ok(!(result.stdout + result.stderr).includes(marker));
});
import { neonTarget } from "../src/lib/db/neon-target.ts";
import { poolConfig } from "../src/lib/db/pool-config.ts";
import { validateDeployment } from "../src/lib/config/deployment.ts";
import { startResourceSampler } from "../src/lib/observability/resources.ts";
import {
  paymentProvider,
  webpayGateway,
} from "../src/modules/payments/providers.ts";
import { cloudArguments, cloudCommand } from "../scripts/cloud/command.ts";
const host = "ep-fixture.us-east-1.aws.neon.tech",
  target = `${host}/autoparts_public`;
const direct = `postgresql://fixture:never-real-password@${host}/autoparts_public?sslmode=require&channel_binding=require`;
const pooled = direct.replace(host, host.replace(".", "-pooler."));
test("destinos Neon exactos, TLS verificable y rechazo de URLs ambiguas/locales", () => {
  assert.equal(
    new URL(neonTarget(direct, target).connectionString).searchParams.get(
      "sslmode",
    ),
    "verify-full",
  );
  assert.throws(() => neonTarget(direct, target + "_other"));
  for (const invalid of [
    direct.replace(host, "127.0.0.1"),
    direct.replace(host, host + ".evil.invalid"),
    direct.replace("sslmode=require", "sslmode=disable"),
    direct + "&host=localhost",
    direct + "&sslmode=disable",
    direct + "&options=-c%20search_path=private",
    direct.replace("/autoparts_public?", "/other?"),
    direct.replace(host, host + ":1234"),
    direct + "#fragment",
    direct.replace("never-real-password@", "@"),
    pooled,
  ])
    assert.throws(() => neonTarget(invalid, target));
  const url = new URL(pooled);
  assert.equal(
    neonTarget(pooled, `${url.hostname}${url.pathname}`, true).database,
    "autoparts_public",
  );
});
test("pool pequeño y configuración de producción seguros sin afectar Docker", () => {
  assert.equal(poolConfig({}).max, 5);
  assert.equal(poolConfig({ VERCEL: "1" }).max, 2);
  assert.equal(poolConfig({ VERCEL: "1" }).connectionTimeoutMillis, 10000);
  assert.throws(() => poolConfig({ VERCEL: "1", DB_POOL_MAX: "100" }));
  assert.throws(() => poolConfig({ DB_POOL_MAX: "1.2" }));
  assert.throws(() => poolConfig({ DB_IDLE_TIMEOUT_MS: "0" }));
  const env = {
    VERCEL: "1",
    DATABASE_URL: pooled,
    NEXTAUTH_URL: "https://autoparts-fixture.vercel.app",
    NEXTAUTH_SECRET: "a".repeat(64),
    PAYMENT_PROVIDER: "simulated",
  };
  assert.doesNotThrow(() => validateDeployment(env));
  assert.throws(() =>
    validateDeployment({ ...env, NEXTAUTH_URL: "http://localhost:3000" }),
  );
  assert.throws(() => validateDeployment({ ...env, DATABASE_URL: direct }));
  assert.throws(() =>
    validateDeployment({
      ...env,
      NEXTAUTH_URL: env.NEXTAUTH_URL + "/private?token=x",
    }),
  );
  assert.throws(() =>
    validateDeployment({ ...env, PAYMENT_PROVIDER: "webpay_integration" }),
  );
});
test("Vercel no inicia monitor permanente y prohíbe todo acceso Webpay", (t) => {
  const old = {
    vercel: process.env.VERCEL,
    resources: process.env.RESOURCE_METRICS_ENABLED,
    payment: process.env.PAYMENT_PROVIDER,
  };
  try {
    process.env.VERCEL = "1";
    process.env.RESOURCE_METRICS_ENABLED = "true";
    process.env.PAYMENT_PROVIDER = "simulated";
    const timer = t.mock.method(globalThis, "setInterval");
    startResourceSampler();
    assert.equal(timer.mock.callCount(), 0);
    assert.equal(paymentProvider(), "SIMULATED");
    assert.throws(() => webpayGateway());
    process.env.PAYMENT_PROVIDER = "webpay_integration";
    assert.throws(paymentProvider);
  } finally {
    for (const [key, value] of Object.entries({
      VERCEL: old.vercel,
      RESOURCE_METRICS_ENABLED: old.resources,
      PAYMENT_PROVIDER: old.payment,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test("scripts cloud: simulación sin conexión y validación anterior a --execute", async (t) => {
  assert.throws(() => cloudArguments([]));
  assert.throws(() =>
    cloudArguments(["--env-file", ".env", "--confirm-target", target]),
  );
  assert.throws(() =>
    cloudArguments([
      "--env-file",
      ".env.neon.local",
      "--confirm-target",
      target,
      "--execute",
      "--execute",
    ]),
  );
  await mkdir("tmp", { recursive: true });
  const dir = await mkdtemp(path.join(process.cwd(), "tmp", "cloud-guards-"));
  const file = path.join(dir, ".env.neon.local");
  await writeFile(file, `DIRECT_URL=${direct}\n`);
  const connect = t.mock.method(Client.prototype, "connect", () => {
    throw new Error("No se permite conexión de red en esta prueba.");
  });
  const args = ["--env-file", file, "--confirm-target", target];
  await cloudCommand("migrate", args);
  await cloudCommand("bootstrap", args);
  assert.equal(connect.mock.callCount(), 0);
  await writeFile(
    file,
    "DIRECT_URL=postgresql://fixture:never-real-password@127.0.0.1:5432/autoparts?sslmode=require\n",
  );
  await assert.rejects(cloudCommand("migrate", [...args, "--execute"]));
  assert.equal(connect.mock.callCount(), 0);
  await writeFile(file, `DATABASE_URL=${direct}\n`);
  await assert.rejects(cloudCommand("bootstrap", args));
  assert.equal(connect.mock.callCount(), 0);
});
