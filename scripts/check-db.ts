import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db/prisma.ts";

try {
  const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1::int AS ok`;
  assert.equal(result[0]?.ok, 1);
  // Leer los ocho modelos confirma que la migración está disponible sin insertar datos.
  const counts = await prisma.$transaction([
    prisma.user.count(), prisma.category.count(), prisma.product.count(),
    prisma.cart.count(), prisma.cartItem.count(), prisma.order.count(),
    prisma.orderItem.count(), prisma.paymentAttempt.count(),
  ]);
  console.log("Conexión Prisma/PostgreSQL correcta. Ocho tablas consultadas.", { counts });
} catch {
  console.error("Falló la comprobación de PostgreSQL. Revisa disponibilidad, DATABASE_URL y migraciones.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
