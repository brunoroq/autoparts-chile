import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { analyticsTestUrl } from "../tests/analytics-database.ts";
import { authTestSecret } from "../tests/auth-database.ts";
import { exportMetrics } from "./export-metrics.ts";
const base = "http://localhost:3106";
let server: ChildProcess | undefined,
  output = "";
try {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3106",
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: analyticsTestUrl(),
        NEXTAUTH_URL: base,
        NEXTAUTH_SECRET: authTestSecret(),
        ANALYTICS_ENABLED: "false",
        WEB_VITALS_ENABLED: "true",
        RESOURCE_METRICS_ENABLED: "true",
        RESOURCE_SAMPLE_MS: "5000",
        EXPERIMENT_ID: "observability-smoke",
        TRAFFIC_KIND: "synthetic",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.on("data", (d) => {
    output += String(d);
  });
  server.stderr?.on("data", (d) => {
    output += String(d);
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/api/auth/providers")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready, "Servidor aislado no disponible");
  const start = performance.now();
  assert.equal((await fetch(base + "/api/v1/products")).status, 200);
  assert.equal((await fetch(base + "/api/v1/products?page=0")).status, 400);
  assert.equal((await fetch(base + "/api/v1/cart")).status, 401);
  for (const sequence of [1, 2])
    assert.equal(
      (
        await fetch(base + "/api/v1/telemetry/web-vitals", {
          method: "POST",
          headers: { Origin: base, "Content-Type": "application/json" },
          body: JSON.stringify({
            metrics: [
              {
                id: "smoke-cls",
                name: "CLS",
                value: sequence * 0.1,
                sequence,
                path: "/catalogo",
                device: "desktop",
              },
            ],
          }),
        })
      ).status,
      200,
    );
  for (
    let i = 0;
    i < 60 && !output.includes('"event":"postgres_resources"');
    i++
  )
    await new Promise((r) => setTimeout(r, 250));
  assert.match(output, /"event":"process_resources"/);
  assert.match(output, /"event":"postgres_resources"/);
  const docker = execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/observe-docker.ts", "1"],
    {
      env: {
        ...process.env,
        EXPERIMENT_ID: "observability-smoke",
        TRAFFIC_KIND: "synthetic",
      },
      encoding: "utf8",
    },
  );
  assert.match(docker, /"event":"docker_resources"/);
  for (const secret of [
    process.env.NEXTAUTH_SECRET,
    process.env.POSTGRES_PASSWORD,
    authTestSecret(),
    process.env.DATABASE_URL,
  ].filter(Boolean) as string[])
    assert.ok(!output.includes(secret), "Secreto conocido en logs");
  await mkdir("tmp", { recursive: true });
  const folder = await mkdtemp(
    path.join(process.cwd(), "tmp", "observability-"),
  );
  const input = path.join(folder, "capture.jsonl");
  await writeFile(input, output + "\n" + docker);
  const report = await exportMetrics(
    input,
    path.join(folder, "export"),
    (performance.now() - start) / 1000,
  );
  const summary = JSON.parse(
    await readFile(path.join(folder, "export", "summary.json"), "utf8"),
  );
  assert.equal(report.uniqueVitals, 1);
  assert.equal(summary.vitals[0].p75, 0.2);
  assert.ok(
    summary.requests.some(
      (r: { businessErrors: number }) => r.businessErrors > 0,
    ),
  );
  assert.equal(summary.resourceErrors, 0);
  const resources = JSON.parse(
    await readFile(path.join(folder, "export", "resources.json"), "utf8"),
  );
  for (const event of [
    "process_resources",
    "postgres_resources",
    "docker_resources",
  ])
    assert.ok(resources.some((r: { event: string }) => r.event === event));
  console.log("Observabilidad real y exportación verificadas:", report);
} finally {
  if (server && server.exitCode === null) {
    const end = once(server, "exit");
    server.kill();
    await end;
  }
}
