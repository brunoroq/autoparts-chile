import type { Prisma } from "../../generated/prisma/client";
import type { CatalogFilters } from "./validation";

export const productSelect = {
  id: true,
  sku: true,
  slug: true,
  name: true,
  description: true,
  priceClp: true,
  stock: true,
  imagePath: true,
  imageAlt: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

export function catalogWhere(
  filters: CatalogFilters,
): Prisma.ProductWhereInput {
  return {
    active: true,
    ...(filters.category ? { category: { slug: filters.category } } : {}),
    priceClp: { gte: filters.minPrice, lte: filters.maxPrice },
    ...(filters.q
      ? {
          OR: ["name", "description", "sku"].map((field) => ({
            [field]: { contains: filters.q, mode: "insensitive" },
          })),
        }
      : {}),
  };
}

export function catalogOrder(
  sort: CatalogFilters["sort"],
): Prisma.ProductOrderByWithRelationInput[] {
  return sort === "name_asc"
    ? [{ name: "asc" }, { id: "asc" }]
    : [{ priceClp: sort === "price_asc" ? "asc" : "desc" }, { id: "asc" }];
}
