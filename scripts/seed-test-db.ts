import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { testDatabaseUrl } from "../tests/database.ts";
import { seedCatalog } from "../prisma/seed.ts";
import { parseSeedSize } from "../prisma/seed-data.ts";

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--size")
  throw new Error("Uso: npm run db:seed:test -- --size 30|1000|10000");
const size = parseSeedSize(args[1]);
const client = new PrismaClient({
  adapter: new PrismaPg({ connectionString: testDatabaseUrl(), max: 5 }),
});
try {
  console.log("Seed aislado:", await seedCatalog(client, size));
} finally {
  await client.$disconnect();
}
