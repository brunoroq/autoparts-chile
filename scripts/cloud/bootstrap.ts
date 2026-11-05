import type { PrismaClient } from "../../src/generated/prisma/client";
import { buildCatalog } from "../../prisma/seed-data";
// Solo inserciones. Ningún campo de productos/categorías existentes se actualiza.
export function bootstrapCatalog(client: PrismaClient) {
  const { categories, products } = buildCatalog(30);
  return client.$transaction(
    async (tx) => {
      const currentCategories = await tx.category.findMany({
        where: {
          OR: [
            { id: { in: categories.map((c) => c.id) } },
            { slug: { in: categories.map((c) => c.slug) } },
          ],
        },
      });
      if (
        currentCategories.some(
          (c) =>
            !categories.some(
              (seed) => seed.id === c.id && seed.slug === c.slug,
            ),
        )
      )
        throw new Error("BOOTSTRAP_IDENTITY_CONFLICT");
      const current = await tx.product.findMany({
        where: {
          OR: [
            { id: { in: products.map((p) => p.id) } },
            { sku: { in: products.map((p) => p.sku) } },
            { slug: { in: products.map((p) => p.slug) } },
          ],
        },
        select: { id: true, sku: true, slug: true },
      });
      if (
        current.some(
          (p) =>
            !products.some(
              (seed) =>
                seed.id === p.id && seed.sku === p.sku && seed.slug === p.slug,
            ),
        )
      )
        throw new Error("BOOTSTRAP_IDENTITY_CONFLICT");
      const insertedCategories = await tx.category.createMany({
        data: categories,
        skipDuplicates: true,
      });
      const insertedProducts = await tx.product.createMany({
        data: products,
        skipDuplicates: true,
      });
      return {
        insertedCategories: insertedCategories.count,
        insertedProducts: insertedProducts.count,
        existingCatalogRecordsPreserved: true,
      };
    },
    { maxWait: 5000, timeout: 10000 },
  );
}
