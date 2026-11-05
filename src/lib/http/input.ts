import { ApiError } from "./errors";

export function checkOrigin(request: Request) {
  const canonical = process.env.NEXTAUTH_URL;
  if (!canonical)
    throw new ApiError(
      "Configuración de autenticación incompleta.",
      500,
      "CONFIGURATION_ERROR",
    );
  if (request.headers.get("origin") !== new URL(canonical).origin)
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
