export function poolConfig(env: Record<string, string | undefined> = process.env) {
  const cloud = env.VERCEL === "1";
  function integer(name: string, fallback: number, min: number, max: number) {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n < min || n > max)
      throw new Error(`Configuración ${name} fuera de rango.`);
    return n;
  }
  return {
    max: integer("DB_POOL_MAX", cloud ? 2 : 5, 1, cloud ? 5 : 10),
    connectionTimeoutMillis: integer(
      "DB_CONNECT_TIMEOUT_MS",
      cloud ? 10000 : 5000,
      1000,
      30000,
    ),
    idleTimeoutMillis: integer("DB_IDLE_TIMEOUT_MS", 10000, 1000, 60000),
    allowExitOnIdle: true,
    enableChannelBinding: cloud,
    application_name: "autoparts-web",
  };
}
