import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import { spawn } from "node:child_process";
import { Client, type ClientConfig } from "pg";
import { neonTarget, type NeonTarget } from "../../src/lib/db/neon-target";
export function cloudArguments(args: string[]) {
  const values = new Map<string, string>();
  let execute = false;
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--execute") {
      if (execute) throw new Error("Argumento repetido.");
      execute = true;
      continue;
    }
    if (
      !["--env-file", "--confirm-target"].includes(key) ||
      values.has(key) ||
      !args[i + 1] ||
      args[i + 1].startsWith("--")
    )
      throw new Error(
        "Uso: --env-file .env.neon.local --confirm-target host/base [--execute]. Simulación por defecto.",
      );
    values.set(key, args[++i]);
  }
  if (!values.get("--env-file") || !values.get("--confirm-target"))
    throw new Error(
      "Indica archivo de entorno y confirmación exacta host/base. No se usa DATABASE_URL local.",
    );
  const file = path.resolve(values.get("--env-file")!);
  if (path.basename(file) !== ".env.neon.local")
    throw new Error(
      "Usa un archivo exclusivo llamado .env.neon.local, nunca .env de Docker.",
    );
  return { file, confirmation: values.get("--confirm-target")!, execute };
}
async function verifyDatabase(target: NeonTarget) {
  // pg ya soporta channel binding; la versión instalada de @types/pg aún no declara esta opción.
  const config: ClientConfig & { enableChannelBinding: boolean } = {
    connectionString: target.connectionString,
    connectionTimeoutMillis: 10000,
    statement_timeout: 5000,
    enableChannelBinding: true,
  };
  const client = new Client(config);
  try {
    await client.connect();
    const result = await client.query("SELECT current_database() AS name");
    if (result.rows[0]?.name !== target.database)
      throw new Error("Destino remoto distinto del confirmado.");
  } finally {
    await client.end();
  }
}
async function migrate(target: NeonTarget) {
  // Una única operación permitida, sin shell y sin heredar credenciales locales como destino.
  const child = spawn(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: {
        ...process.env,
        DATABASE_URL: target.connectionString,
        DIRECT_URL: target.connectionString,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  // No volcar errores arbitrarios del driver/CLI que podrían incorporar la conexión.
  child.stdout?.resume();
  child.stderr?.resume();
  await new Promise<void>((resolve, reject) => {
    child.once("error", () => reject(new Error("No se pudo iniciar Prisma.")));
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "Prisma migrate deploy no finalizó correctamente. Revisar destino/permisos; no publicar credenciales.",
            ),
          ),
    );
  });
  return { migration: "migrate deploy", completed: true };
}
export async function cloudCommand(
  operation: "migrate" | "bootstrap",
  args: string[],
) {
  const options = cloudArguments(args);
  const data = parse(await readFile(options.file, "utf8"));
  // Sin fallback a variables del proceso, .env de Docker ni host suministrado en parámetros separados.
  const target = neonTarget(data.DIRECT_URL, options.confirmation);
  console.log(
    JSON.stringify({
      operation,
      mode: options.execute ? "execute" : "dry-run",
      host: target.host,
      database: target.database,
      tls: "verify-full",
    }),
  );
  if (!options.execute) {
    console.log(
      "Simulación: no hubo conexión ni escrituras. Requiere autorización antes de usar --execute.",
    );
    return;
  }
  await verifyDatabase(target);
  if (operation === "migrate") console.log(await migrate(target));
  else {
    const [{ PrismaClient }, { PrismaPg }, { bootstrapCatalog }] =
      await Promise.all([
        import("../../src/generated/prisma/client"),
        import("@prisma/adapter-pg"),
        import("./bootstrap"),
      ]);
    const client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: target.connectionString,
        max: 1,
        connectionTimeoutMillis: 10000,
        enableChannelBinding: true,
      }),
    });
    try {
      console.log(await bootstrapCatalog(client));
    } finally {
      await client.$disconnect();
    }
  }
}
export function safeCloudFailure() {
  console.error(
    "Operación cloud detenida. Revisa argumentos, archivo exclusivo, destino Neon, TLS, permisos y estado de migraciones. No se imprimieron credenciales.",
  );
  process.exitCode = 1;
}
