import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedCatalog } from "../prisma/seed.ts";
import { buildCatalog } from "../prisma/seed-data.ts";
import {
  listProducts,
  findProduct,
  listCategories,
} from "../src/modules/catalog/service.ts";
import { parseFilters } from "../src/modules/catalog/validation.ts";
import { testDatabaseUrl } from "./database.ts";

test("catálogo real, seed repetible, tamaños y protección no destructiva en base aislada", async () => {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl(), max: 5 }),
  });
  const id = buildCatalog(30).products[0].id;
  try {
    // Permite repetir esta prueba conservando el catálogo grande de una ejecución anterior.
    const before = await client.product.count();
    const initialSize = before > 1000 ? 10000 : before > 30 ? 1000 : 30;
    await seedCatalog(client, initialSize);
    const first = await client.product.findMany({
      select: { id: true, sku: true, priceClp: true },
      orderBy: { id: "asc" },
    });
    await seedCatalog(client, initialSize);
    assert.deepEqual(
      await client.product.findMany({
        select: { id: true, sku: true, priceClp: true },
        orderBy: { id: "asc" },
      }),
      first,
    );
    const f = (q: string) => parseFilters(new URLSearchParams(q));
    const all = await listProducts(f("pageSize=60"), client);
    assert.equal(all.meta.total, initialSize);
    assert.equal((await listCategories(client)).length, 6);
    const selected = await listProducts(
      f(
        "q=H7&category=iluminacion&minPrice=20000&maxPrice=25000&sort=price_asc",
      ),
      client,
    );
    assert.ok(selected.data.length > 0);
    assert.ok(
      selected.data.every(
        (p) =>
          p.name.includes("H7") &&
          p.category.slug === "iluminacion" &&
          p.priceClp >= 20000 &&
          p.priceClp <= 25000,
      ),
    );
    assert.equal(
      (await listProducts(f("q=zzzz-no-existe"), client)).meta.total,
      0,
    );
    for (const sort of ["name_asc", "price_asc", "price_desc"]) {
      const a = await listProducts(f(`sort=${sort}&pageSize=5`), client);
      const b = await listProducts(f(`sort=${sort}&pageSize=5&page=2`), client);
      assert.equal(new Set([...a.data, ...b.data].map((p) => p.id)).size, 10);
      assert.deepEqual(
        a,
        await listProducts(f(`sort=${sort}&pageSize=5`), client),
      );
      if (sort.startsWith("price")) {
        const prices = [...a.data, ...b.data].map((p) => p.priceClp);
        assert.deepEqual(
          prices,
          [...prices].sort((x, y) => (sort === "price_asc" ? x - y : y - x)),
        );
      }
    }
    const product = await findProduct(id, "id", client);
    assert.ok(product);
    assert.equal(product.currency, "CLP");
    assert.equal((await findProduct(product.slug, "slug", client))?.id, id);
    await client.product.update({ where: { id }, data: { active: false } });
    assert.equal(await findProduct(id, "id", client), null);
    assert.equal(
      (await listProducts(f("q=AP-SEED-00001"), client)).meta.total,
      0,
    );
    await client.product.update({ where: { id }, data: { active: true } });
    assert.equal(
      await findProduct("00000000-0000-5000-a000-000000000000", "id", client),
      null,
    );
    assert.equal((await listProducts(f("page=999999"), client)).data.length, 0);
    for (const size of [1000, 10000]) {
      if (size >= initialSize) {
        await seedCatalog(client, size);
        assert.equal(await client.product.count(), size);
      }
    }
    await assert.rejects(seedCatalog(client, 30), /catálogo mayor/);
    assert.equal(await client.product.count(), 10000);
  } finally {
    await client.product.updateMany({ where: { id }, data: { active: true } });
    await client.$disconnect();
  }
});
