import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import {
  profiles,
  durationSeconds,
  limits,
} from "../performance/k6/scenarios.js";
import { BASE_URL, validatePlan } from "../performance/k6/safety.js";
import { exportMetrics } from "./export-metrics";
import { verifyPerformanceEndpoint } from "./performance-endpoint";
import { validSyntheticId } from "../src/lib/analytics/synthetic";
import { runPerformanceObserver } from "./run-performance-observer";
import {
  BROWSER_BASE_URL,
  BROWSER_LIMITS,
} from "../performance/k6/browser-policy.js";
import { uuid, cwvWindow, validateStudy, type Study } from "./cwv-protocol";
import { cwvClockReader } from "./cwv-clock";
import { validateCwvContainers, cwvFingerprint } from "./cwv-isolation";
import type { Container } from "./performance-observer-container";
import { allocateCwvOutput } from "./cwv-files";
import { warmCwvPages } from "./cwv-warmup";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docker =
  process.env.DOCKER_BIN ||
  (process.platform === "win32"
    ? path.join(
        process.env.LOCALAPPDATA || "",
        "Programs/DockerDesktop/resources/bin/docker.exe",
      )
    : "docker");
const k6 =
  process.env.K6_BIN ||
  (process.platform === "win32" ? "C:/Program Files/k6/k6.exe" : "k6");
const args = process.argv.slice(2),
  action = args.shift();
const value = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i < 0 ? fallback : args[i + 1];
};
const runId = value("--run-id", randomUUID());
const profile = value("--profile", "baja") as keyof typeof profiles;
const catalogSize = Number(value("--catalog", "30"));
const model = value("--model", "closed") as "closed" | "arrival";
const peakRate = Number(value("--rate", "1"));
const execute = args.includes("--execute");
const withBrowser = args.includes("--browser");
const browserOnly = args.includes("--observer-only");
const syntheticId = value("--synthetic-id", "");
const measurementId = value("--measurement-id", "");
const cwvStudyId = value("--study-id", "");
const baseline = action === "baseline";
const allowed = [
  "--run-id",
  "--profile",
  "--catalog",
  "--model",
  "--rate",
  "--execute",
  "--browser",
  "--observer-only",
  "--synthetic-id",
  "--measurement-id",
  "--study-id",
];
for (let i = 0; i < args.length; i++) {
  if (!allowed.includes(args[i])) throw new Error("Argumento desconocido.");
  if (!["--execute", "--browser", "--observer-only"].includes(args[i])) {
    if (!args[i + 1] || args[i + 1].startsWith("--"))
      throw new Error("Falta valor.");
    i++;
  }
}
if (
  (withBrowser &&
    (!validSyntheticId(syntheticId, process.env.GA4_MEASUREMENT_ID) ||
      model !== "closed" ||
      action === "prepare" ||
      !browserOnly ||
      profile !== "baja" ||
      catalogSize !== 30)) ||
  (!withBrowser && (syntheticId || browserOnly))
)
  throw new Error(
    "El observador requiere --browser --synthetic-id G-ID_LAB, modelo closed y destino separado.",
  );
if (
  (measurementId || baseline) &&
  (!uuid.test(measurementId) ||
    measurementId === runId ||
    withBrowser ||
    !uuid.test(cwvStudyId) ||
    !["plan", "baseline", "run"].includes(action || "") ||
    profile !== "normal" ||
    model !== "closed" ||
    catalogSize !== 30 ||
    peakRate !== 1)
)
  throw new Error(
    "CWV requiere estudio/UUID nuevos, perfil normal/closed/30 y no admite --browser.",
  );
if (cwvStudyId && !measurementId)
  throw new Error("CWV requiere --measurement-id.");
if (
  !["plan", "prepare", "run", "baseline"].includes(action || "") ||
  !/^[a-f0-9-]{36}$/.test(runId) ||
  !Object.hasOwn(profiles, profile) ||
  ![30, 1000, 10000].includes(catalogSize) ||
  !["closed", "arrival"].includes(model) ||
  !Number.isInteger(peakRate) ||
  peakRate < 1 ||
  peakRate > 5
)
  throw new Error(
    "Uso: perf -- plan|prepare|run|baseline [--run-id UUID] [--profile baja|normal|pico] [--catalog 30|1000|10000] [--model closed|arrival] [--rate 1..5 recorridos/s] [--measurement-id UUID] [--execute]",
  );
const directory = path.join(root, "artifacts/performance", runId);
const envFile = path.join(directory, "compose.env");
const lockFile = path.join(root, "artifacts/performance/active.lock");
let ownsLock = false;
let stage = "arguments";
const compose = [
  "compose",
  "--project-name",
  "autoparts-performance",
  "--file",
  path.join(root, "compose.performance.yaml"),
  "--env-file",
  envFile,
];
// No se cargan .env del repositorio ni variables DATABASE_URL del shell.
const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv))
  if (
    /^(PERF_|K6_|GA4_|ANALYTICS_|DATABASE_URL$|DIRECT_URL$|COMPOSE_)/.test(key)
  )
    delete cleanEnv[key];
cleanEnv.K6_NO_USAGE_REPORT = "true";
const children: ReturnType<typeof spawn>[] = [];
let measurementAborted = false;
if (measurementId && execute)
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      measurementAborted = true;
      for (const child of children)
        if (child.exitCode === null && child.signalCode === null) child.kill();
    });
const call = (binary: string, commands: string[], timeout = 15000) =>
  execFileSync(binary, commands, {
    cwd: root,
    env: cleanEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
function readiness() {
  const info = JSON.parse(call(docker, ["info", "--format", "{{json .}}"]));
  if (
    info.OSType !== "linux" ||
    info.NCPU < 4 ||
    info.MemTotal < 6 * 1024 ** 3 ||
    os.freemem() < 2 * 1024 ** 3
  )
    throw new Error(
      "Docker Linux requiere al menos 4 CPU, 6 GiB asignados y 2 GiB libres en el host.",
    );
  const version = baseline ? "not-started-baseline" : call(k6, ["version"]);
  if (!baseline && !version.includes("v2.3.0"))
    throw new Error("Se requiere k6 v2.3.0 para reproducibilidad.");
  return {
    dockerCpus: info.NCPU,
    dockerMemoryBytes: info.MemTotal,
    dockerVersion: info.ServerVersion,
    k6: version.trim(),
    hostCpus: os.cpus().length,
    hostMemoryBytes: os.totalmem(),
  };
}
async function main() {
  if (action === "plan" || !execute) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          action,
          runId,
          measurementId: measurementId || null,
          studyId: cwvStudyId || null,
          condition: measurementId ? (baseline ? "baseline" : "normal") : null,
          baseUrl: withBrowser ? BROWSER_BASE_URL : BASE_URL,
          profile,
          model,
          peakRate,
          catalogSize,
          stages: withBrowser || baseline ? [] : profiles[profile],
          limits: withBrowser
            ? {
                maxVus: 1,
                maxSeconds: 120,
                maxRequests: BROWSER_LIMITS.requests,
                maxBytes: BROWSER_LIMITS.bytes,
              }
            : measurementId
              ? {
                  maxVus: baseline ? 0 : 10,
                  maxSeconds: baseline ? 330 : 450,
                  maxRequests: baseline ? 0 : 10000,
                }
              : limits,
          browser: withBrowser
            ? {
                observers: 1,
                journeys: 1,
                httpWorkload: !browserOnly,
                measurementId: syntheticId,
                limits: BROWSER_LIMITS,
              }
            : false,
          message:
            "Sin solicitudes HTTP, contenedores, migraciones ni carga. prepare/run/baseline requieren --execute y autorización.",
        },
        null,
        2,
      ),
    );
    return;
  }
  stage = "requirements";
  const resources = readiness();
  mkdirSync(path.dirname(lockFile), { recursive: true });
  writeFileSync(lockFile, JSON.stringify({ pid: process.pid, runId }), {
    flag: "wx",
  });
  ownsLock = true;
  if (action === "prepare") {
    // No sustituir silenciosamente un laboratorio anterior del mismo proyecto.
    if (
      call(docker, [
        "ps",
        "-aq",
        "--filter",
        "label=com.docker.compose.project=autoparts-performance",
      ]).trim()
    )
      throw new Error(
        "Ya existe laboratorio; detener y revisar manualmente antes de preparar otro.",
      );
    mkdirSync(path.dirname(directory), { recursive: true });
    mkdirSync(directory, { recursive: false });
    const local = {
      PERF_DB_PASSWORD: randomBytes(24).toString("hex"),
      PERF_AUTH_SECRET: randomBytes(32).toString("hex"),
      PERF_PAYMENT_SECRET: randomBytes(32).toString("hex"),
      PERF_RUN_ID: runId,
      PERF_EXPERIMENT_ID: runId,
      PERF_CATALOG_SIZE: String(catalogSize),
      PERF_CONCURRENCY: "unspecified",
    };
    writeFileSync(
      envFile,
      Object.entries(local)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n"),
      { flag: "wx", mode: 0o600 },
    );
    writeFileSync(
      path.join(directory, "configuration.json"),
      JSON.stringify({ runId, catalogSize, resources }, null, 2),
      { flag: "wx" },
    );
    stage = "build-isolated-image";
    call(docker, [...compose, "build"], 900000);
    stage = "prepare-isolated-database";
    call(docker, [...compose, "up", "-d", "--wait", "postgres"], 180000);
    call(docker, [...compose, "run", "--rm", "--no-deps", "prepare"], 180000);
    call(docker, [...compose, "up", "-d", "--wait", "app"], 180000);
    stage = "verify-prepared-instance-from-host";
    await verifyPerformanceEndpoint(runId, catalogSize);
    console.log(
      JSON.stringify({
        prepared: true,
        runId,
        catalogSize,
        next: `npm run perf -- run --run-id ${runId} --profile baja --execute`,
      }),
    );
    return;
  }
  if (!args.includes("--run-id") || !existsSync(envFile))
    throw new Error("Usar el UUID del entorno preparado.");
  const local = parse(readFileSync(envFile));
  const config = JSON.parse(
    readFileSync(path.join(directory, "configuration.json"), "utf8"),
  );
  if (
    local.PERF_RUN_ID !== runId ||
    Number(local.PERF_CATALOG_SIZE) !== config.catalogSize
  )
    throw new Error("Configuración local inconsistente.");
  if (args.includes("--catalog") && catalogSize !== config.catalogSize)
    throw new Error(
      "El tamaño solicitado no coincide con el laboratorio preparado.",
    );
  if (withBrowser) {
    await runPerformanceObserver(
      {
        root,
        environmentId: runId,
        measurementId: syntheticId,
        k6,
        env: cleanEnv,
        source: {
          commit: call("git", ["rev-parse", "HEAD"]).trim(),
          dirty: !!call("git", ["status", "--porcelain"]).trim(),
        },
      },
      (commands, timeout) => call(docker, commands, timeout),
    );
    return;
  }
  let cwvPgId = "",
    cwvImage = "",
    cwvChromeVersion = "",
    cwvBefore: Record<string, { count: number; hash: string }> | undefined;
  let cwvProductRoute = "";
  const inspectCwv = () =>
    JSON.parse(
      call(docker, [
        "inspect",
        "autoparts-performance-app-1",
        "autoparts-performance-postgres-1",
      ]),
    ) as Container[];
  if (measurementId) {
    const study = JSON.parse(
      readFileSync(
        path.join(root, "artifacts/cwv", cwvStudyId, "study.json"),
        "utf8",
      ),
    ) as Study;
    validateStudy(study);
    if (
      study.environmentId !== runId ||
      !study.visits.some(
        (v) =>
          v.runId === measurementId &&
          v.condition === (baseline ? "baseline" : "normal"),
      )
    )
      throw new Error("CWV_STUDY_RUN_MISMATCH");
    if (
      process.env.DOCKER_HOST ||
      process.env.DOCKER_CONTEXT ||
      process.platform !== "win32"
    )
      throw new Error("CWV_HOST_OVERRIDE_OR_PLATFORM_INVALID");
    const chromeVersion = call("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "(Get-Item -LiteralPath 'C:/Program Files/Google/Chrome/Application/chrome.exe').VersionInfo.ProductVersion",
    ]).trim();
    if (chromeVersion !== study.chromeVersion)
      throw new Error("CWV_CHROME_VERSION_CHANGED");
    cwvChromeVersion = chromeVersion;
    cwvProductRoute = study.visits.find((v) => v.page === "product")!.route;
    const context = JSON.parse(call(docker, ["context", "inspect"]))[0];
    if (
      !context.Endpoints?.docker?.Host?.startsWith(
        process.platform === "win32" ? "npipe://" : "unix://",
      )
    )
      throw new Error("CWV_DOCKER_NOT_LOCAL");
    const source = validateCwvContainers(inspectCwv(), runId);
    if (
      !JSON.parse(
        call(docker, ["network", "inspect", source.privateNetwork]),
      )[0].Internal
    )
      throw new Error("CWV_NETWORK_NOT_PRIVATE");
    cwvPgId = source.pg.Id;
    cwvImage = source.app.Image;
    cwvBefore = cwvFingerprint((a, t) => call(docker, a, t), cwvPgId);
    if (cwvBefore.Product.count !== 30 || cwvBefore.Category.count !== 6)
      throw new Error("CWV_CATALOG_INVALID");
  }
  // Las mediciones nuevas nunca reutilizan baja/normal/pico históricos.
  const output = measurementId
    ? allocateCwvOutput(directory, measurementId)
    : path.join(directory, `${profile}-${model}`);
  if (!measurementId) mkdirSync(output, { recursive: false }); // No sobrescribir ni repetir una condición accidentalmente.
  const maxVus = baseline
    ? 0
    : model === "arrival"
      ? 30
      : Math.max(...profiles[profile].map((s) => s.target));
  const experimentId = measurementId || randomUUID();
  local.PERF_CONCURRENCY = String(maxVus);
  local.PERF_EXPERIMENT_ID = experimentId;
  local.PERF_BROWSER_ANALYTICS = withBrowser ? "true" : "false";
  local.PERF_GA4_SYNTHETIC_MEASUREMENT_ID = withBrowser ? syntheticId : "";
  local.PERF_WEB_VITALS = measurementId ? "true" : "false";
  writeFileSync(
    envFile,
    Object.entries(local)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
    { mode: 0o600 },
  );
  call(docker, [...compose, "up", "-d", "--wait", "app"], 180000);
  // Comprobar la instancia antes de emitir el plan; no seguir redirecciones.
  stage = "verify-isolated-instance";
  await verifyPerformanceEndpoint(experimentId, config.catalogSize);
  if (measurementId) {
    const source = validateCwvContainers(inspectCwv(), runId);
    if (
      source.pg.Id !== cwvPgId ||
      source.app.Image !== cwvImage ||
      !source.app.Config.Env.includes("WEB_VITALS_ENABLED=true")
    )
      throw new Error("CWV_EFFECTIVE_CONFIG_INVALID");
    // Antes de medir se calientan las mismas rutas/variantes de imagen en ambas condiciones.
    const warmed = await warmCwvPages(cwvProductRoute);
    writeFileSync(
      path.join(output, "warmup.json"),
      JSON.stringify(warmed, null, 2),
      { flag: "wx" },
    );
    if (os.freemem() < 2 * 1024 ** 3) throw new Error("CWV_HOST_MEMORY_LOW");
  }
  const seconds = baseline
    ? 300
    : browserOnly
      ? 90
      : durationSeconds(profiles[profile]);
  const createdAt = Date.now();
  // Reservar la comprobación HTTP del comando principal dentro del límite total.
  const plan = baseline
    ? {
        runId: experimentId,
        baseUrl: BASE_URL,
        condition: "baseline",
        maxVus: 0,
        createdAt,
        deadline: createdAt + 330000,
      }
    : validatePlan({
        runId: experimentId,
        baseUrl: BASE_URL,
        profile,
        model,
        peakRate,
        catalogSize: config.catalogSize,
        maxVus,
        maxRequests: limits.maxRequests - 1,
        createdAt,
        deadline: createdAt + (durationSeconds(profiles[profile]) + 30) * 1000,
        output: output.replaceAll("\\", "/"),
      });
  const planFile = path.join(output, "plan.json");
  writeFileSync(planFile, JSON.stringify(plan, null, 2), { flag: "wx" });
  writeFileSync(
    path.join(output, "manifest.json"),
    JSON.stringify(
      {
        ...config,
        resources,
        plan,
        cwv: measurementId
          ? {
              studyId: cwvStudyId,
              chromeVersion: cwvChromeVersion,
              condition: baseline ? "baseline" : "normal",
              analytics: false,
              webVitals: true,
              manualBrowser: true,
              serverImage: cwvImage,
            }
          : false,
        browser: withBrowser
          ? {
              observers: 1,
              journeys: 1,
              httpWorkload: !browserOnly,
              measurementId: syntheticId,
            }
          : false,
        commit: call("git", ["rev-parse", "HEAD"]).trim(),
        dirty: !!call("git", ["status", "--porcelain"]).trim(),
        warmup: baseline
          ? "Sin generador HTTP; margen15s"
          : "Ramp-up incluido; analizar meseta por separado",
        startedAt: new Date(createdAt).toISOString(),
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  if (cwvBefore)
    writeFileSync(
      path.join(output, "data-before.json"),
      JSON.stringify(cwvBefore),
      { flag: "wx" },
    );
  const samples = Math.ceil((seconds + 15) / 5);
  const observer = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/observe-docker.ts",
      String(samples),
      "--performance",
      envFile,
    ],
    {
      cwd: root,
      env: {
        ...cleanEnv,
        DOCKER_BIN: docker,
        DOCKER_SAMPLE_MS: "5000",
        EXPERIMENT_ID: experimentId,
        APP_ENV: "performance-local",
        TRAFFIC_KIND: "synthetic",
        CATALOG_SIZE: String(config.catalogSize),
        EXPERIMENT_CONCURRENCY: String(maxVus),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const observerClosed = new Promise<void>((resolve) =>
    observer.once("close", () => resolve()),
  );
  children.push(observer);
  let observations = "";
  observer.stdout.on("data", (b) => {
    observations += String(b);
  });
  let observerFailed = false;
  stage = baseline ? "cwv-baseline-capture" : "k6-local-execution";
  if (measurementAborted) throw new Error("CWV_ABORTED_BEFORE_CAPTURE");
  // Baseline no inicia k6: solo proceso reloj inerte mientras el operador mide.
  const child = baseline
    ? spawn(
        process.execPath,
        ["-e", "setTimeout(()=>process.exit(0),300000)"],
        { cwd: root, env: cleanEnv, stdio: ["ignore", "pipe", "pipe"] },
      )
    : spawn(
        k6,
        [
          "run",
          "--out",
          `json=${path.join(output, "k6.jsonl")}`,
          "--out",
          `csv=${path.join(output, "k6.csv")}`,
          "-e",
          `PERF_PLAN=${planFile}`,
          "performance/k6/journeys.js",
        ],
        {
          cwd: root,
          env: measurementId
            ? { ...cleanEnv, PERF_CWV: "true", K6_LOG_FORMAT: "json" }
            : cleanEnv,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
  children.push(child);
  observer.on("error", () => {
    observerFailed = true;
    child.kill();
  });
  observer.on("exit", (code) => {
    if (code !== null && code !== 0) {
      observerFailed = true;
      child.kill();
    }
  });
  // Watchdog externo: no depende de que el script respete los stages.
  const timer = setTimeout(
    () => {
      child.kill();
    },
    (seconds + 30) * 1000,
  );
  let healthTick = 0;
  const memoryWatch = setInterval(() => {
    try {
      if (os.freemem() < 2 * 1024 ** 3) throw new Error("HOST_MEMORY_LOW");
      if (measurementId && ++healthTick % 3 === 0)
        validateCwvContainers(inspectCwv(), runId);
    } catch {
      observerFailed = true;
      child.kill();
    }
  }, 2000);
  let runError = false;
  child.on("error", () => {
    runError = true;
  });
  // No imprimir cuerpos ni cabeceras; guardar únicamente el estado de salida.
  let clockCaptured = false;
  const emitWindow = (w: ReturnType<typeof cwvWindow>) => {
    writeFileSync(
      path.join(output, "cwv-window.json"),
      JSON.stringify(w, null, 2),
      { flag: "wx" },
    );
    clockCaptured = true;
    console.log(JSON.stringify(w));
  };
  if (baseline) emitWindow(cwvWindow(experimentId, "baseline", createdAt));
  if (measurementId && !baseline) {
    const outClock = cwvClockReader(experimentId, createdAt, emitWindow),
      errClock = cwvClockReader(experimentId, createdAt, emitWindow);
    child.stdout.on("data", outClock);
    child.stderr.on("data", errClock);
  } else {
    child.stdout.resume();
    child.stderr.resume();
  }
  observer.stderr.resume();
  const code = await new Promise<number | null>((resolve) => {
    child.once("exit", resolve);
    child.once("error", () => resolve(null));
  });
  clearTimeout(timer);
  clearInterval(memoryWatch);
  observer.kill();
  await observerClosed;
  const endedAt = Date.now();
  if (measurementAborted) runError = true;
  if (measurementId) {
    try {
      const source = validateCwvContainers(inspectCwv(), runId);
      const after = cwvFingerprint((a, t) => call(docker, a, t), source.pg.Id);
      const unchanged =
        source.pg.Id === cwvPgId &&
        JSON.stringify(after) === JSON.stringify(cwvBefore);
      writeFileSync(
        path.join(output, "data-after.json"),
        JSON.stringify({ unchanged, data: after }),
        { flag: "wx" },
      );
      if (!unchanged || !clockCaptured) runError = true;
    } catch {
      runError = true;
    }
  }
  stage = "collect-and-export";
  const logs = call(docker, [
    ...compose,
    "logs",
    "--no-color",
    "--no-log-prefix",
    "--since",
    new Date(createdAt).toISOString(),
    "app",
  ]);
  const metrics =
    logs
      .split(/\r?\n/)
      .filter((line) => {
        try {
          return typeof JSON.parse(line).event === "string";
        } catch {
          return false;
        }
      })
      .join("\n") +
    "\n" +
    observations;
  const input = path.join(output, "application.jsonl");
  writeFileSync(input, metrics, { flag: "wx" });
  writeFileSync(
    path.join(output, "outcome.json"),
    JSON.stringify(
      {
        exitCode: code,
        runError,
        observerFailed,
        endedAt: new Date(endedAt).toISOString(),
        elapsedSeconds: (endedAt - createdAt) / 1000,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  await exportMetrics(
    input,
    path.join(output, "application"),
    (endedAt - createdAt) / 1000,
  );
  console.log(
    JSON.stringify({
      environmentId: runId,
      experimentId,
      profile,
      exitCode: code,
      observerFailed,
      output,
    }),
  );
  if (code !== 0 || runError || observerFailed) process.exitCode = 1;
}
main()
  .catch((e) => {
    console.error(e);
    console.error(
      JSON.stringify({
        operation: "performance",
        stage,
        code: "PERFORMANCE_STOPPED",
        message:
          "Revisar Docker, recursos, plan y destino local; no se reintenta automáticamente.",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null) child.kill();
    if (ownsLock) unlinkSync(lockFile);
  });
