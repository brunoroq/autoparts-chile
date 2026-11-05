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
const container = (
  await exec(docker, ["compose", "ps", "-q", "postgres"], { timeout: 5000 })
).stdout.trim();
if (!container) throw new Error("No hay contenedor PostgreSQL activo.");
for (let i = 0; i < samples; i++) {
  const raw = JSON.parse(
    (
      await exec(
        docker,
        ["stats", "--no-stream", "--format", "{{json .}}", container],
        { timeout: 10000 },
      )
    ).stdout.trim(),
  );
  console.log(
    JSON.stringify({
      event: "docker_resources",
      timestamp: new Date().toISOString(),
      ...experimentContext(),
      service: "postgres",
      ...dockerCounters(raw),
    }),
  );
  if (i + 1 < samples) await new Promise((r) => setTimeout(r, interval));
}
