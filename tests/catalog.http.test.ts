import test from "node:test";
import assert from "node:assert/strict";

const base = process.env.BASE_URL ?? "http://localhost:3000";
type Item = {
  id: string;
  slug: string;
  name: string;
  priceClp: number;
  currency: string;
  category: { slug: string };
};
async function get(path: string, status = 200) {
  const response = await fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, status, path);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(response.headers.get("server-timing")?.includes("db;dur="));
  assert.ok(response.headers.get("x-request-id"));
  return response.json();
}
test("listado y categorías HTTP con base PostgreSQL", async () => {
  const categories = await get("/api/v1/categories");
  assert.equal(categories.data.length, 6);
  const products = await get("/api/v1/products");
  assert.ok(products.meta.total >= 30);
  assert.equal(products.data.length, 12);
  assert.ok(
    products.data.every(
      (p: Item) => p.currency === "CLP" && Number.isInteger(p.priceClp),
    ),
  );
  const first = products.data[0];
  const detail = await get(`/api/v1/products/${first.id}`);
  assert.equal(detail.data.id, first.id);
});
test("búsqueda, filtros combinados, orden y paginación HTTP", async () => {
  const result = await get(
    "/api/v1/products?q=LED&category=iluminacion&minPrice=0&maxPrice=30000&sort=price_desc",
  );
  assert.ok(result.data.length > 0);
  assert.ok(
    result.data.every(
      (p: Item) => p.category.slug === "iluminacion" && p.priceClp <= 30000,
    ),
  );
  const prices = result.data.map((p: Item) => p.priceClp);
  assert.deepEqual(
    prices,
    [...prices].sort((a, b) => b - a),
  );
  const first = await get("/api/v1/products?pageSize=5&sort=price_asc");
  const next = await get("/api/v1/products?pageSize=5&page=2&sort=price_asc");
  assert.equal(
    new Set([...first.data, ...next.data].map((p: Item) => p.id)).size,
    10,
  );
  assert.deepEqual(
    first,
    await get("/api/v1/products?pageSize=5&sort=price_asc"),
  );
  assert.equal((await get("/api/v1/products?q=zzzz-no-existe")).meta.total, 0);
});
test("400 y 404 HTTP con contrato seguro", async () => {
  for (const path of [
    "/api/v1/products?page=0",
    "/api/v1/products?q=a&q=b",
    "/api/v1/products?minPrice=99&maxPrice=1",
    "/api/v1/products?pageSize=61",
    "/api/v1/products/no-id",
    "/api/v1/categories?foo=1",
  ]) {
    const body = await get(path, 400);
    assert.ok(body.error.code);
    assert.ok(body.error.requestId);
  }
  assert.equal(
    (await get("/api/v1/products/00000000-0000-5000-a000-000000000000", 404))
      .error.code,
    "NOT_FOUND",
  );
});
