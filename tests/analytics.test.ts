import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  commerce,
  safeCommerce,
  normalizedPath,
  analyticsContext,
} from "../src/lib/analytics/contracts.ts";
import { vitalsInput } from "../src/lib/observability/vitals.ts";
test("contexto GA omite debug_mode false y sanea rutas sin cambiar importes CLP", () => {
  const config = { measurementId: "G-TEST12345", enabled: false, vitals: false, environment: "local", experimentId: "unit", traffic: "human" as const, debug: false, origin: "http://localhost:3018" };
  const clean = analyticsContext(config, "/pedidos/private?token=secret");
  assert.equal(Object.hasOwn(clean, "debug_mode"), false);
  assert.equal(clean.page_location, "http://localhost:3018/pedidos/[id]");
  assert.ok(!JSON.stringify(clean).includes("secret"));
  assert.equal(analyticsContext({ ...config, debug: true }, "/").debug_mode, true);
});
import { analyticsConfig } from "../src/lib/observability/config.ts";
import {
  dockerBytes,
  dockerCounters,
} from "../src/lib/observability/docker.ts";
test("recursos Docker convierten unidades y contadores a bytes numéricos", () => {
  assert.equal(dockerBytes("1.5MiB"), 1572864);
  assert.equal(dockerBytes("2MB"), 2000000);
  assert.equal(dockerBytes("invalid"), null);
  const sample = dockerCounters({
    MemUsage: "1MiB / 2GiB",
    BlockIO: "3MB / 4kB",
    NetIO: "5KB / 6MB",
    CPUPerc: "12.5%",
    MemPerc: "1.0%",
    PIDs: "8",
  });
  assert.equal(sample.blockReadBytes, 3000000);
  assert.equal(sample.memoryBytes, 1048576);
  assert.equal(sample.cpuPercent, 12.5);
});
import {
  summarize,
  consolidateVitals,
  csv,
  exportMetrics,
} from "../scripts/export-metrics.ts";
test("eventos CLP por lista permitida, sin campos personales o precios manipulados", () => {
  const value = commerce(
    [{ productId: randomUUID(), unitPriceClp: 24990, quantity: 2 }],
    randomUUID(),
  );
  assert.equal(value.value, 49980);
  assert.equal(value.currency, "CLP");
  const extra = {
    ...value,
    email: "private@example.invalid",
    token: "secret",
    items: value.items.map((i) => ({ ...i, password: "never" })),
  };
  assert.ok(!JSON.stringify(safeCommerce(extra)).includes("private"));
  assert.ok(!JSON.stringify(safeCommerce(extra)).includes("password"));
  assert.equal(safeCommerce({ ...value, value: 1 }), null);
  assert.equal(
    normalizedPath("/pedidos/secret?token_ws=private"),
    "/pedidos/[id]",
  );
  assert.equal(normalizedPath("/catalogo?q=email@example.invalid"), "/otra");
});
test("configuración exige opt-in e IDs separados para tráfico sintético", () => {
  const keys = [
    "ANALYTICS_ENABLED",
    "GA4_MEASUREMENT_ID",
    "GA4_SYNTHETIC_MEASUREMENT_ID",
    "TRAFFIC_KIND",
  ] as const;
  const old = keys.map((k) => process.env[k]);
  try {
    process.env.ANALYTICS_ENABLED = "false";
    process.env.GA4_MEASUREMENT_ID = "G-TEST12345";
    assert.equal(analyticsConfig().enabled, false);
    process.env.ANALYTICS_ENABLED = "true";
    process.env.TRAFFIC_KIND = "synthetic";
    process.env.GA4_SYNTHETIC_MEASUREMENT_ID = "G-TEST12345";
    assert.equal(analyticsConfig().enabled, false);
    process.env.GA4_SYNTHETIC_MEASUREMENT_ID = "G-OTHER12345";
    assert.equal(analyticsConfig().enabled, true);
  } finally {
    keys.forEach((k, i) => {
      if (old[i] === undefined) delete process.env[k];
      else process.env[k] = old[i];
    });
  }
});
test("Web Vitals valida unidades y consolida la última secuencia", () => {
  const base = {
    id: "metric-1",
    name: "CLS",
    value: 0.12,
    sequence: 1,
    path: "/pedidos/private",
    device: "mobile",
  };
  const [v] = vitalsInput({ metrics: [base] });
  assert.equal(v.unit, "score");
  assert.equal(v.path, "/pedidos/[id]");
  assert.throws(() => vitalsInput({ metrics: [{ ...base, value: -1 }] }));
  assert.throws(() =>
    vitalsInput({ metrics: [{ ...base, email: "private" }] }),
  );
  const result = consolidateVitals([
    { event: "web_vital", ...v },
    { event: "web_vital", ...v, value: 0.2, sequence: 3 },
    { event: "web_vital", ...v, value: 0.15, sequence: 2 },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].value, 0.2);
});
test("percentiles, throughput y errores comerciales/técnicos exportables", async () => {
  const records = [10, 20, 30, 100].map((totalMs, i) => ({
    event: "api_request",
    route: "/api/test",
    method: "GET",
    totalMs,
    status: i === 3 ? 500 : i === 2 ? 409 : 200,
    errorKind: i === 3 ? "technical" : i === 2 ? "business" : "none",
    dbMs: 5,
    providerMs: 1,
  }));
  const [summary] = summarize(records, 2);
  assert.equal(summary.throughputRps, 2);
  assert.equal(summary.p50Ms, 20);
  assert.equal(summary.p95Ms, 100);
  assert.equal(summary.businessErrors, 1);
  assert.equal(summary.technicalErrors, 1);
  assert.equal(summarize(records)[0].throughputRps, null);
  assert.match(csv([{ field: "=formula" }]), /'=formula/);
  await mkdir(path.join(process.cwd(), "tmp"), { recursive: true });
  const folder = await mkdtemp(path.join(process.cwd(), "tmp", "metrics-"));
  const input = path.join(folder, "input.jsonl");
  await writeFile(input, records.map((r) => JSON.stringify(r)).join("\n"));
  await exportMetrics(input, path.join(folder, "output"), 2);
  assert.equal(
    JSON.parse(
      await readFile(path.join(folder, "output", "summary.json"), "utf8"),
    ).requests[0].count,
    4,
  );
  await assert.rejects(exportMetrics(input, path.join(folder, "output"), 2), {
    code: "EEXIST",
  });
});
