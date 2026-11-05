import "dotenv/config";
import { Client } from "pg";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const mode = process.argv[2],
  file = "tmp/deployment-local-before.json";
if (!["before", "after"].includes(mode))
  throw new Error("Uso: before|after. Solo consultas de lectura.");
const connectionString = process.env.DATABASE_URL;
if (
  !connectionString ||
  !["localhost", "127.0.0.1"].includes(new URL(connectionString).hostname)
)
  throw new Error("Comprobación limitada a la base local existente.");
const client = new Client({ connectionString });
const result: Record<string, { count: number; digest: string }> = {};
try {
  await client.connect();
  await client.query(
    "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  for (const table of [
    "User",
    "Category",
    "Product",
    "Cart",
    "CartItem",
    "Order",
    "OrderItem",
    "PaymentAttempt",
    "_prisma_migrations",
  ]) {
    const record = await client.query(
      `SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, E'\\n' ORDER BY t.id), '')) AS digest FROM "${table}" t`,
    );
    result[table] = record.rows[0];
  }
  await client.query("COMMIT");
} finally {
  await client.end();
}
if (mode === "before") {
  await mkdir("tmp", { recursive: true });
  await writeFile(file, JSON.stringify(result, null, 2), { flag: "wx" });
  console.log("Huella de lectura guardada sin datos ni credenciales.");
} else {
  assert.deepEqual(result, JSON.parse(await readFile(file, "utf8")));
  console.log(
    "Base local íntegra: ocho tablas y metadatos de migraciones coinciden exactamente con la huella anterior.",
  );
}
