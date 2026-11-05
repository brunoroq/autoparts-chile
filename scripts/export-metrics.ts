import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";
export type RecordData = Record<string, unknown>;
export function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
export function consolidateVitals(records: RecordData[]) {
  const latest = new Map<string, RecordData>();
  for (const r of records) {
    if (r.event !== "web_vital") continue;
    const key = JSON.stringify([
      r.environment,
      r.experimentId,
      r.traffic,
      r.id,
      r.name,
    ]);
    const previous = latest.get(key);
    if (!previous || Number(r.sequence) > Number(previous.sequence))
      latest.set(key, r);
  }
  return [...latest.values()];
}
export function summarize(records: RecordData[], durationSeconds?: number) {
  const requests = records.filter(
    (r) =>
      r.event === "api_request" &&
      typeof r.totalMs === "number" &&
      Number.isFinite(r.totalMs),
  );
  const groups = new Map<string, RecordData[]>();
  for (const r of requests) {
    const key = JSON.stringify([
      r.environment,
      r.experimentId,
      r.traffic,
      r.catalogSize,
      r.concurrency,
      r.route,
      r.method,
    ]);
    const group = groups.get(key) || [];
    group.push(r);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const [
      environment,
      experimentId,
      traffic,
      catalogSize,
      concurrency,
      route,
      method,
    ] = JSON.parse(key);
    const ms = rows.map((r) => Number(r.totalMs));
    return {
      environment,
      experimentId,
      traffic,
      catalogSize,
      concurrency,
      route,
      method,
      count: rows.length,
      meanMs: ms.reduce((a, b) => a + b, 0) / ms.length,
      p50Ms: percentile(ms, 0.5),
      p95Ms: percentile(ms, 0.95),
      p99Ms: percentile(ms, 0.99),
      throughputRps: durationSeconds ? rows.length / durationSeconds : null,
      http4xx: rows.filter(
        (r) => Number(r.status) >= 400 && Number(r.status) < 500,
      ).length,
      http5xx: rows.filter((r) => Number(r.status) >= 500).length,
      technicalErrors: rows.filter((r) => r.errorKind === "technical").length,
      businessErrors: rows.filter((r) => r.errorKind === "business").length,
      rateLimited: rows.filter((r) => r.errorKind === "rate_limit").length,
      commercialOutcomes: rows.filter((r) => r.businessOutcome).length,
      dbMeanMs: rows.reduce((n, r) => n + Number(r.dbMs || 0), 0) / rows.length,
      providerMeanMs:
        rows.reduce((n, r) => n + Number(r.providerMs || 0), 0) / rows.length,
    };
  });
}
export function csv(records: RecordData[]) {
  const fields = [...new Set(records.flatMap(Object.keys))];
  const cell = (v: unknown) => {
    const text =
      v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return (
      '"' +
      (/^[=+@-]/.test(text) && typeof v !== "number" ? "'" : "") +
      text.replaceAll('"', '""') +
      '"'
    );
  };
  return (
    fields.map(cell).join(",") +
    "\n" +
    records.map((r) => fields.map((k) => cell(r[k])).join(",")).join("\n") +
    "\n"
  );
}
export async function exportMetrics(
  input: string,
  output: string,
  durationSeconds?: number,
) {
  if (
    durationSeconds !== undefined &&
    (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
  )
    throw new Error("Duración inválida.");
  const records: RecordData[] = [];
  let ignored = 0;
  for await (const line of createInterface({
    input: createReadStream(input),
    crlfDelay: Infinity,
  })) {
    if (line.length > 100000) {
      ignored++;
      continue;
    }
    try {
      const r = JSON.parse(line.replace(/^\uFEFF/, ""));
      if (
        r &&
        typeof r === "object" &&
        [
          "api_request",
          "web_vital",
          "process_resources",
          "postgres_resources",
          "docker_resources",
          "resource_error",
          "render_error",
        ].includes(r.event)
      )
        records.push(r);
      else ignored++;
    } catch {
      ignored++;
    }
    if (records.length > 1000000)
      throw new Error("Dividir archivos de más de un millón de registros.");
  }
  if (!records.length)
    throw new Error(
      "No hay métricas JSON válidas. Verifica captura y codificación UTF-8.",
    );
  const vitals = consolidateVitals(records),
    summary = summarize(records, durationSeconds),
    resources = records.filter((r) =>
      ["process_resources", "postgres_resources", "docker_resources"].includes(
        String(r.event),
      ),
    );
  const vitalGroups = new Map<string, RecordData[]>();
  for (const r of vitals) {
    const key = JSON.stringify([
      r.environment,
      r.experimentId,
      r.traffic,
      r.device,
      r.path,
      r.name,
      r.unit,
    ]);
    const group = vitalGroups.get(key) || [];
    group.push(r);
    vitalGroups.set(key, group);
  }
  const vitalSummary = [...vitalGroups].map(([key, rows]) => {
    const [environment, experimentId, traffic, device, route, name, unit] =
      JSON.parse(key);
    return {
      environment,
      experimentId,
      traffic,
      device,
      route,
      name,
      unit,
      count: rows.length,
      p75: percentile(
        rows.map((r) => Number(r.value)),
        0.75,
      ),
    };
  });
  await mkdir(output, { recursive: true });
  for (const [name, data] of Object.entries({
    "summary.json": JSON.stringify(
      {
        durationSeconds: durationSeconds ?? null,
        ignoredLines: ignored,
        requests: summary,
        vitals: vitalSummary,
        resourceErrors: records.filter((r) => r.event === "resource_error")
          .length,
        renderErrors: records.filter((r) => r.event === "render_error").length,
      },
      null,
      2,
    ),
    "requests.csv": csv(records.filter((r) => r.event === "api_request")),
    "summary.csv": csv(summary),
    "web-vitals.csv": csv(vitals),
    "resources.csv": csv(resources),
    "resources.json": JSON.stringify(resources, null, 2),
  }))
    await writeFile(path.join(output, name), data, { flag: "wx" });
  return { records: records.length, uniqueVitals: vitals.length, output };
}
if (process.argv[1] && /export-metrics\.(ts|js)$/.test(process.argv[1])) {
  const [, , input, output, duration] = process.argv;
  if (!input || !output)
    throw new Error(
      "Uso: npm run metrics:export -- entrada.jsonl directorio_nuevo [duración_segundos]",
    );
  console.log(
    await exportMetrics(input, output, duration ? Number(duration) : undefined),
  );
}
