export type NeonTarget = {
  connectionString: string;
  host: string;
  database: string;
  confirmation: string;
};
export function neonTarget(
  raw: string | undefined,
  confirmation: string,
  pooled = false,
): NeonTarget {
  const invalid = () =>
    new Error(
      "Destino inválido: se requiere una conexión Neon TLS y confirmación exacta host/base. No se realizó ninguna operación.",
    );
  if (!raw) throw invalid();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid();
  }
  const host = url.hostname;
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !/^ep-[a-z0-9-]+\.(?:[a-z0-9-]+\.)+(?:neon\.tech)$/.test(host) ||
    !url.username ||
    !url.password ||
    url.hash ||
    (url.port && url.port !== "5432") ||
    !/^\/[a-z0-9][a-z0-9_-]{0,62}$/.test(url.pathname)
  )
    throw invalid();
  if (host.split(".")[0].endsWith("-pooler") !== pooled) throw invalid();
  const allowed = ["sslmode", "channel_binding", "schema"];
  for (const key of url.searchParams.keys())
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1)
      throw invalid();
  if (
    !["require", "verify-full"].includes(
      url.searchParams.get("sslmode") || "",
    ) ||
    (url.searchParams.has("channel_binding") &&
      url.searchParams.get("channel_binding") !== "require") ||
    (url.searchParams.has("schema") &&
      url.searchParams.get("schema") !== "public")
  )
    throw invalid();
  const database = url.pathname.slice(1),
    expected = `${host}/${database}`;
  if (confirmation !== expected) throw invalid();
  // Evitar semánticas ambiguas de sslmode=require entre versiones de pg.
  url.searchParams.set("sslmode", "verify-full");
  return { connectionString: url.href, host, database, confirmation: expected };
}
