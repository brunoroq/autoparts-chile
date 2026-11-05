import { prisma } from "../../lib/db/prisma";
import type { PrismaClient } from "../../generated/prisma/client";
import { catalogOrder, catalogWhere, productSelect } from "./queries";
import type { CatalogFilters } from "./validation";

export async function listProducts(
  filters: CatalogFilters,
  client: PrismaClient = prisma,
) {
  const where = catalogWhere(filters);
  // Snapshot común para que total y página correspondan al mismo estado de datos.
  const [total, data] = await client.$transaction(
    [
      client.product.count({ where }),
      client.product.findMany({
        where,
        select: productSelect,
        orderBy: catalogOrder(filters.sort),
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    data: data.map((p) => ({ ...p, currency: "CLP" as const })),
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize),
    },
  };
}

export async function listCategories(client: PrismaClient = prisma) {
  const categories = await client.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { products: { where: { active: true } } } },
    },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c._count.products,
  }));
}

export async function findProduct(
  value: string,
  by: "id" | "slug" = "id",
  client: PrismaClient = prisma,
) {
  const product = await client.product.findFirst({
    where: { [by]: value, active: true },
    select: productSelect,
  });
  return product ? { ...product, currency: "CLP" as const } : null;
}

export type CatalogProduct = Awaited<
  ReturnType<typeof listProducts>
>["data"][number];
export type CatalogCategory = Awaited<
  ReturnType<typeof listCategories>
>[number];
