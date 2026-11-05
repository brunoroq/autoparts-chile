import { neonTarget } from "../db/neon-target";
export function validateDeployment(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL !== "1") return;
  if (env.PAYMENT_PROVIDER && env.PAYMENT_PROVIDER !== "simulated")
    throw new Error(
      "Vercel: esta publicación admite exclusivamente pagos simulados.",
    );
  let canonical: URL;
  try {
    canonical = new URL(env.NEXTAUTH_URL || "");
  } catch {
    throw new Error("Vercel: falta NEXTAUTH_URL HTTPS canónica.");
  }
  if (
    canonical.protocol !== "https:" ||
    canonical.username ||
    canonical.password ||
    canonical.pathname !== "/" ||
    canonical.search ||
    canonical.hash ||
    ["localhost", "127.0.0.1", "[::1]"].includes(canonical.hostname)
  )
    throw new Error(
      "Vercel: NEXTAUTH_URL debe ser el origen público HTTPS sin rutas ni parámetros.",
    );
  if (
    !env.NEXTAUTH_SECRET ||
    env.NEXTAUTH_SECRET.length < 32 ||
    env.NEXTAUTH_SECRET.startsWith("replace_")
  )
    throw new Error(
      "Vercel: configura un secreto de autenticación exclusivo y aleatorio.",
    );
  let db: URL;
  try {
    db = new URL(env.DATABASE_URL || "");
  } catch {
    throw new Error("Vercel: falta DATABASE_URL de Neon pooled.");
  }
  neonTarget(env.DATABASE_URL, `${db.hostname}${db.pathname}`, true);
}
