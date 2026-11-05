import "dotenv/config";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildCatalog, parseSeedSize, DATASET_VERSION } from "./seed-data.ts";

export async function seedCatalog(client: PrismaClient, size: number) {
  const { categories, products } = buildCatalog(size);
  const expected = new Map(products.map((p) => [p.id, p]));
  // Validar toda la identidad antes de escribir; nunca borrar registros para reducir tamaño.
  const existing = await client.product.findMany({
    select: { id: true, sku: true, slug: true },
  });
  if (
    existing.some(
      (p) =>
        !expected.has(p.id) ||
        expected.get(p.id)?.sku !== p.sku ||
        expected.get(p.id)?.slug !== p.slug,
    )
  ) {
    throw new Error(
      "La base tiene productos ajenos o un catálogo mayor. Usa una base aislada; no se eliminó información.",
    );
  }
  const knownCategories = new Map(categories.map((c) => [c.id, c]));
  const currentCategories = await client.category.findMany();
  if (
    currentCategories.some((c) => knownCategories.get(c.id)?.slug !== c.slug)
  ) {
    throw new Error("La base tiene categorías ajenas. Usa una base aislada.");
  }
  await client.$transaction(
    categories.map((c) =>
      client.category.upsert({ where: { id: c.id }, create: c, update: c }),
    ),
  );
  for (let offset = 0; offset < products.length; offset += 100) {
    await client.$transaction(
      products
        .slice(offset, offset + 100)
        .map((p) =>
          client.product.upsert({ where: { id: p.id }, create: p, update: p }),
        ),
    );
  }
  return {
    version: DATASET_VERSION,
    categories: await client.category.count(),
    products: await client.product.count(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--size")
    throw new Error("Uso: npm run db:seed -- --size 30|1000|10000");
  const size = parseSeedSize(args[1]);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL.");
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 5 }),
  });
  try {
    console.log("Seed completado:", await seedCatalog(client, size));
  } finally {
    await client.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Falló el seed.");
    process.exitCode = 1;
  });
}
