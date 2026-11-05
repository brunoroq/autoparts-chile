import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError } from "../http/errors";
import { measure } from "../observability/request";

const OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
const PREFIX = "scrypt$v1$131072$8$1";
const DUMMY_HASH = `${PREFIX}$${"0".repeat(32)}$${"0".repeat(128)}`;
let activeHashes = 0;

export function validPassword(password: unknown): password is string {
  return (
    typeof password === "string" &&
    Array.from(password).length >= 12 &&
    Array.from(password).length <= 128 &&
    Buffer.byteLength(password, "utf8") <= 512
  );
}

async function derive(password: string, salt: Buffer) {
  if (activeHashes >= 2)
    throw new ApiError(
      "Hay varias solicitudes de acceso. Intenta en unos segundos.",
      429,
      "AUTH_BUSY",
      2,
    );
  activeHashes++;
  try {
    return await measure(
      "hash",
      () =>
        new Promise<Buffer>((resolve, reject) =>
          scrypt(password, salt, 64, OPTIONS, (error, key) =>
            error ? reject(error) : resolve(key),
          ),
        ),
    );
  } finally {
    activeHashes--;
  }
}

export async function hashPassword(password: string) {
  if (!validPassword(password))
    throw new ApiError("La contraseña debe tener entre 12 y 128 caracteres.");
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `${PREFIX}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
) {
  if (!validPassword(password)) return false;
  const encoded = stored ?? DUMMY_HASH;
  const parts = encoded.split("$");
  if (
    parts.length !== 7 ||
    parts.slice(0, 5).join("$") !== PREFIX ||
    !/^[0-9a-f]{32}$/.test(parts[5]) ||
    !/^[0-9a-f]{128}$/.test(parts[6])
  )
    return false;
  const actual = await derive(password, Buffer.from(parts[5], "hex"));
  return timingSafeEqual(actual, Buffer.from(parts[6], "hex")) && !!stored;
}
