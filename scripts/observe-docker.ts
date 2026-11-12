import { dockerCounters } from "../src/lib/observability/docker";
import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import path from "node:path";
import { experimentContext } from "../src/lib/observability/config";
const exec = promisify(execFile);
const local = path.join(process.env.LOCALAPPDATA || "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe");
const docker =
  process.env.DOCKER_BIN ||
  (process.platform === "win32" && existsSync(local) ? local : "docker");
const samples = Number(process.argv[2] || 1),
  interval = Number(process.env.DOCKER_SAMPLE_MS || 15000);
if (
  !Number.isInteger(samples) ||
  samples < 1 ||
  samples > 10000 ||
  !Number.isInteger(interval) ||
  interval < 1000 ||
  interval > 300000
)
  throw new Error("Parámetros de muestreo inválidos.");
const performanceMode = process.argv[3] === '--performance';
const envFile = process.argv[4];
if (performanceMode && !envFile) throw new Error('Falta archivo exclusivo del laboratorio.');
const compose = performanceMode
  ? ['compose', '--project-name', 'autoparts-performance', '--file', 'compose.performance.yaml', '--env-file', envFile]
  : ['compose'];
const services = performanceMode ? ['app', 'postgres'] : ['postgres'];
const containers = await Promise.all(services.map(async service => {
  const container = (await exec(docker, [...compose, 'ps', '-q', service], { timeout: 5000 })).stdout.trim();
  if (!container || !/^[a-f0-9]+$/.test(container)) throw new Error('No hay contenedor único para el servicio.');
  return { service, container };
}));
const previous = new Map<string, { at: number; read: number | null; write: number | null }>();
const saturated = new Map<string, number>();
for (let i = 0; i < samples; i++) {
 for (const { service, container } of containers) {
  const raw = JSON.parse(
    (
      await exec(
        docker,
        ["stats", "--no-stream", "--format", "{{json .}}", container],
        { timeout: 10000 },
      )
    ).stdout.trim(),
  );
  const counters = dockerCounters(raw);
  const at = Date.now(), last = previous.get(service);
  const seconds = last ? (at - last.at) / 1000 : 0;
  const delta = (now: number | null, before: number | null | undefined) => now !== null && before != null && seconds > 0 && now >= before ? (now - before) / seconds : null;
  // Una muestra aislada no prueba saturación. Seis consecutivas activan la parada.
  const count = counters.cpuPercent >= 190 || counters.memoryPercent >= 95 ? (saturated.get(service) || 0) + 1 : 0;
  saturated.set(service, count);
  console.log(
    JSON.stringify({
      event: "docker_resources",
      timestamp: new Date().toISOString(),
      ...experimentContext(),
      service,
      ...counters,
      blockReadBytesPerSecond: delta(counters.blockReadBytes, last?.read),
      blockWriteBytesPerSecond: delta(counters.blockWriteBytes, last?.write),
    }),
  );
  previous.set(service, { at, read: counters.blockReadBytes, write: counters.blockWriteBytes });
  if (performanceMode && count >= 6) {
    console.log(JSON.stringify({ event: 'resource_error', code: 'SUSTAINED_RESOURCE_SATURATION', service }));
    process.exit(2);
  }
 }
  if (i + 1 < samples) await new Promise((r) => setTimeout(r, interval));
}
