import { execFileSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { authTestUrl } from "../tests/auth-database.ts";
import { seedCatalog } from "../prisma/seed.ts";
const connectionString = authTestUrl();
execFileSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "scripts/prepare-test-db.ts"],
  {
    env: { ...process.env, TEST_DATABASE_URL: connectionString },
    stdio: "inherit",
  },
);
const client = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
try {
  console.log("Catálogo aislado:", await seedCatalog(client, 30));
} finally {
  await client.$disconnect();
}
