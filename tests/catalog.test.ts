import test from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, parseSeedSize } from "../prisma/seed-data.ts";
import {
  parseFilters,
  assertProductId,
} from "../src/modules/catalog/validation.ts";
import { catalogOrder, catalogWhere } from "../src/modules/catalog/queries.ts";
import { formatClp } from "../src/lib/format.ts";
import { catalogResponse } from "../src/lib/observability/request.ts";

test("valida filtros, precios enteros, límites y parámetros repetidos", () => {
  const filters = parseFilters(
    new URLSearchParams(
      "q=%20LED%20&category=iluminacion&minPrice=0&maxPrice=25000&sort=price_asc",
    ),
  );
  assert.equal(filters.q, "LED");
  assert.equal(filters.minPrice, 0);
  assert.equal(filters.pageSize, 12);
  for (const query of [
    "page=0",
    "page=1.5",
    "pageSize=61",
    "minPrice=-1",
    "maxPrice=1e3",
    "minPrice=10&maxPrice=5",
    "sort=sql",
    "q=a&q=b",
    "foo=1",
    "category=bad/value",
    `q=${"a".repeat(101)}`,
  ])
    assert.throws(() => parseFilters(new URLSearchParams(query)), {
      name: "Error",
    });
});

test("consulta aplica búsqueda, categoría, precios y desempate por ID", () => {
  const filters = parseFilters(
    new URLSearchParams(
      "q=LED&category=iluminacion&minPrice=1000&maxPrice=50000",
    ),
  );
  const where = catalogWhere(filters);
  assert.equal(where.active, true);
  assert.equal(where.OR?.length, 3);
  assert.deepEqual(where.priceClp, { gte: 1000, lte: 50000 });
  assert.deepEqual(catalogOrder("price_asc"), [
    { priceClp: "asc" },
    { id: "asc" },
  ]);
  assert.deepEqual(catalogOrder("price_desc"), [
    { priceClp: "desc" },
    { id: "asc" },
  ]);
  assert.deepEqual(catalogOrder("name_asc"), [{ name: "asc" }, { id: "asc" }]);
});

test("dataset es determinista para 30, 1000 y 10000 sin colisiones", () => {
  for (const size of [30, 1000, 10000]) {
    const first = buildCatalog(size),
      second = buildCatalog(size);
    assert.deepEqual(first, second);
    assert.equal(first.products.length, size);
    assert.equal(first.categories.length, 6);
    for (const key of ["id", "sku", "slug"] as const)
      assert.equal(new Set(first.products.map((p) => p[key])).size, size);
    assert.ok(
      first.products.every(
        (p) => Number.isInteger(p.priceClp) && p.priceClp >= 0,
      ),
    );
    const counts = first.categories.map(
      (c) => first.products.filter((p) => p.categoryId === c.id).length,
    );
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 5);
    assertProductId(first.products[0].id);
  }
  assert.throws(() => parseSeedSize("29"));
  assert.throws(() => parseSeedSize(undefined));
});

test("CLP se formatea sin decimales y UUID inválido se rechaza", () => {
  assert.equal(formatClp(24990).replace(/\s/g, ""), "$24.990");
  assert.throws(() => assertProductId("no-valido"));
});

test("error interno entrega 500 seguro, no-store y correlación", async () => {
  const response = await catalogResponse("/test", async ({ db }) =>
    db(async () => {
      throw new Error("postgres://secret");
    }),
  );
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.text();
  assert.ok(!body.includes("postgres://secret"));
  assert.ok(response.headers.get("server-timing")?.includes("db;dur="));
  assert.ok(response.headers.get("x-request-id"));
});
