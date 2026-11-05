import "dotenv/config";

export function testDatabaseUrl() {
  if (!process.env.DATABASE_URL)
    throw new Error("Falta DATABASE_URL para derivar la base aislada.");
  const url = new URL(
    process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  );
  if (!process.env.TEST_DATABASE_URL) url.pathname = "/autoparts_catalog_test";
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname)
  )
    throw new Error(
      "Pruebas de escritura solo en una base local cuyo nombre termine en _test.",
    );
  return url.toString();
}
