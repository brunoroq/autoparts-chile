import "dotenv/config";
import { createHmac } from "node:crypto";
export function authTestUrl() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL.");
  const url = new URL(
    process.env.AUTH_TEST_DATABASE_URL || process.env.DATABASE_URL,
  );
  if (!process.env.AUTH_TEST_DATABASE_URL)
    url.pathname = "/autoparts_auth_test";
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname)
  )
    throw new Error(
      "La base de autenticación de pruebas debe ser local y terminar en _test.",
    );
  return url.toString();
}
export function authTestSecret() {
  if (!process.env.NEXTAUTH_SECRET) throw new Error("Falta NEXTAUTH_SECRET.");
  return createHmac("sha256", process.env.NEXTAUTH_SECRET)
    .update("autoparts-isolated-auth-tests")
    .digest("hex");
}
