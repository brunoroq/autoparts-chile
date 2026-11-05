import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { poolConfig } from "./pool-config";
import { neonTarget } from "./neon-target";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no está definida.");
  let runtimeUrl = connectionString;
  if (process.env.VERCEL === "1") {
    try {
      const parsed = new URL(connectionString);
      runtimeUrl = neonTarget(
        connectionString,
        `${parsed.hostname}${parsed.pathname}`,
        true,
      ).connectionString;
    } catch {
      throw new Error(
        "DATABASE_URL de Vercel inválida: revisar conexión Neon pooled y TLS sin publicar credenciales.",
      );
    }
  }
  const adapter = new PrismaPg({
    connectionString: runtimeUrl,
    ...poolConfig(),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = prisma;
