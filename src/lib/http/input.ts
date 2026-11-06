import { ApiError } from "./errors";

export function checkOrigin(request: Request) {
  // CSRF protege operaciones inseguras; los GET/HEAD/OPTIONS no deben mutar datos.
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const canonical = process.env.NEXTAUTH_URL;
  let expected: URL;
  try {
    expected = new URL(canonical || "");
    if (
      !["http:", "https:"].includes(expected.protocol) ||
      expected.username || expected.password || expected.pathname !== "/" ||
      expected.search || expected.hash ||
      (process.env.VERCEL === "1" && expected.protocol !== "https:")
    ) throw new Error("Invalid canonical origin");
  } catch {
    throw new ApiError(
      "Configuración de origen incompleta o inválida.",
      500,
      "CONFIGURATION_ERROR",
    );
  }
  // La autoridad viene de configuración del servidor, nunca de Host ni de un
  // dominio *.vercel.app presentado por el cliente. No inferirla de request.url:
  // detrás de un proxy esa URL puede representar el transporte interno.
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (
    request.headers.get("origin") !== expected.origin ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (host !== null && host.toLowerCase() !== expected.host) ||
    (process.env.VERCEL === "1" && forwardedHost !== null &&
      forwardedHost.toLowerCase() !== expected.host)
  )
    throw new ApiError(
      "Origen de la solicitud no permitido.",
      403,
      "INVALID_ORIGIN",
    );
}

export async function readLimitedBody(request: Request, limit = 8192) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new ApiError("Solicitud demasiado grande.", 413, "BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new ApiError(
          "Solicitud demasiado grande.",
          413,
          "BODY_TOO_LARGE",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJson(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new ApiError("Se requiere JSON.", 415, "INVALID_CONTENT_TYPE");
  let body: unknown;
  try {
    body = JSON.parse(await readLimitedBody(request));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("JSON inválido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ApiError("El cuerpo debe ser un objeto JSON.");
  return body as Record<string, unknown>;
}

export function exactFields(body: Record<string, unknown>, fields: string[]) {
  if (Object.keys(body).some((key) => !fields.includes(key)))
    throw new ApiError("La solicitud contiene campos no permitidos.");
}

export function safeReturnPath(value: unknown, fallback = "/carrito") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return fallback;
  const url = new URL(value, "https://local.invalid");
  return url.origin === "https://local.invalid"
    ? `${url.pathname}${url.search}${url.hash}`
    : fallback;
}
