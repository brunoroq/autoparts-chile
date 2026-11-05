import "dotenv/config";
import { Client } from "pg";
import { execFileSync } from "node:child_process";
import { testDatabaseUrl } from "../tests/database.ts";

const connectionString = testDatabaseUrl();
const dbName = new URL(connectionString).pathname.slice(1);
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("La conexión administrativa también debe ser local.");
const admin = new Client({ connectionString: process.env.DATABASE_URL });
try {
  await admin.connect();
  const result = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );
  if (!result.rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  console.log(`Base aislada ${dbName} preparada. No se borraron datos.`);
} finally {
  await admin.end();
}
execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env: { ...process.env, DATABASE_URL: connectionString, DIRECT_URL: connectionString }, stdio: "inherit" },
);
