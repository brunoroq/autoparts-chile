import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { deploymentDatabase } from "./deployment-database.ts";
import { bootstrapCatalog } from "../scripts/cloud/bootstrap.ts";
import { buildCatalog } from "../prisma/seed-data.ts";
test("bootstrap solo inserta, es repetible/concurrente y conserva precios, stock, usuarios y pedidos", async () => {
  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: deploymentDatabase("bootstrap"),
      max: 4,
    }),
  });
  const seed = buildCatalog(30);
  try {
    const previous = await client.product.count({
      where: { id: { in: seed.products.map((p) => p.id) } },
    });
    const results = await Promise.all([
      bootstrapCatalog(client),
      bootstrapCatalog(client),
    ]);
    assert.equal(
      results.reduce((n, r) => n + r.insertedProducts, 0),
      30 - previous,
    );
    const product = await client.product.update({
      where: { id: seed.products[0].id },
      data: {
        priceClp: 111,
        stock: 0,
        active: false,
        name: "Catálogo editado",
      },
    });
    const user = await client.user.create({
      data: {
        email: randomUUID() + "@example.invalid",
        name: "Cuenta de prueba aislada",
        cart: {
          create: { items: { create: { productId: product.id, quantity: 1 } } },
        },
        orders: {
          create: {
            totalClp: 777,
            idempotencyKey: randomUUID(),
            items: {
              create: {
                productId: product.id,
                productName: "Snapshot original",
                unitPriceClp: 777,
                quantity: 1,
              },
            },
            payments: { create: { provider: "SIMULATED", amountClp: 777 } },
          },
        },
      },
    });
    const category = await client.category.create({
      data: { name: "Categoría ajena", slug: randomUUID() },
    });
    const foreign = await client.product.create({
      data: {
        sku: randomUUID(),
        slug: randomUUID(),
        name: "Producto ajeno",
        description: "Fixture",
        categoryId: category.id,
        priceClp: 123,
        stock: 2,
      },
    });
    const include = {
      cart: { include: { items: true } },
      orders: { include: { items: true, payments: true } },
    };
    const before = await client.user.findUniqueOrThrow({
      where: { id: user.id },
      include,
    });
    const result = await bootstrapCatalog(client);
    assert.equal(result.insertedProducts, 0);
    assert.equal(result.insertedCategories, 0);
    assert.deepEqual(
      await client.product.findUniqueOrThrow({ where: { id: product.id } }),
      product,
    );
    assert.deepEqual(
      await client.product.findUniqueOrThrow({ where: { id: foreign.id } }),
      foreign,
    );
    assert.deepEqual(
      await client.user.findUniqueOrThrow({ where: { id: user.id }, include }),
      before,
    );
    const changed = await client.product.update({
      where: { id: product.id },
      data: { sku: randomUUID() },
    });
    try {
      await assert.rejects(
        bootstrapCatalog(client),
        /BOOTSTRAP_IDENTITY_CONFLICT/,
      );
      assert.deepEqual(
        await client.product.findUniqueOrThrow({ where: { id: product.id } }),
        changed,
      );
    } finally {
      await client.product.update({
        where: { id: product.id },
        data: { sku: product.sku },
      });
    }
  } finally {
    await client.$disconnect();
  }
});
