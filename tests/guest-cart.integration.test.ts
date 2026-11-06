import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { authTestUrl } from "./auth-database";
import { changeCart, readCart } from "../src/modules/cart/service";
import { mergeCart } from "../src/modules/cart/merge";
import { quoteGuestCart } from "../src/modules/cart/guest-quote";

test("fusión PostgreSQL: suma, idempotencia concurrente, persistencia y aislamiento", async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: authTestUrl(), max: 5 }) });
  let reopened: PrismaClient | undefined;
  try {
    const user = await db.user.create({ data: { email: `${randomUUID()}@example.invalid` } });
    const other = await db.user.create({ data: { email: `${randomUUID()}@example.invalid` } });
    const category = await db.category.findFirstOrThrow();
    const id = randomUUID();
    const product = await db.product.create({ data: { id, sku: id, slug: id, name: "Fusión aislada", description: "Fixture", categoryId: category.id, priceClp: 12345, stock: 20 } });
    await changeCart(user.id, 0, "add", product.id, 2, db);
    const mergeId = randomUUID(), input = [{ productId: id, quantity: 3 }];
    const results = await Promise.all(Array.from({ length: 4 }, () => mergeCart(user.id, mergeId, input, db)));
    for (const cart of results) { assert.equal(cart.items.length, 1); assert.equal(cart.items[0].quantity, 5); assert.equal(cart.totalClp, 61725); }
    assert.equal(await db.cartMergeReceipt.count({ where: { id: mergeId } }), 1);
    assert.equal((await readCart(user.id, db)).version, 2);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id } })).stock, 20);
    await assert.rejects(mergeCart(other.id, mergeId, input, db), { code: "MERGE_KEY_CONFLICT" });
    await assert.rejects(mergeCart(user.id, mergeId, [{ productId: id, quantity: 4 }], db), { code: "MERGE_KEY_CONFLICT" });
    assert.equal((await readCart(other.id, db)).items.length, 0);
    // Otro cliente/proceso reproduce la recuperación después de una respuesta perdida.
    reopened = new PrismaClient({ adapter: new PrismaPg({ connectionString: authTestUrl() }) });
    assert.equal((await mergeCart(user.id, mergeId, input, reopened)).items[0].quantity, 5);
    // Un reintento tardío no restaura productos que el usuario ya eliminó.
    await changeCart(user.id, 2, "remove", id, undefined, db);
    assert.equal((await mergeCart(user.id, mergeId, input, reopened)).items.length, 0);
    // Dos operaciones distintas sobre un carrito inexistente se serializan sin perder sumas.
    await Promise.all([mergeCart(other.id, randomUUID(), input, db), mergeCart(other.id, randomUUID(), input, db)]);
    assert.equal((await readCart(other.id, db)).items[0].quantity, 6);
    const third = await db.user.create({ data: { email: `${randomUUID()}@example.invalid` } });
    await changeCart(third.id, 0, "add", id, 1, db);
    const mixed = await Promise.allSettled([
      mergeCart(third.id, randomUUID(), [{ productId: id, quantity: 2 }], db),
      changeCart(third.id, 1, "add", id, 1, db),
    ]);
    assert.equal(mixed[0].status, "fulfilled");
    if (mixed[1].status === "rejected") assert.equal(mixed[1].reason.code, "CART_CONFLICT");
    assert.equal((await readCart(third.id, db)).items[0].quantity, mixed[1].status === "fulfilled" ? 4 : 3);
  } finally { await reopened?.$disconnect(); await db.$disconnect(); }
});

test("fusión revierte todo ante stock/inactivos y cotiza con precios reales", async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: authTestUrl() }) });
  try {
    const user = await db.user.create({ data: { email: `${randomUUID()}@example.invalid` } });
    const category = await db.category.findFirstOrThrow();
    const make = (stock: number, active = true) => { const id = randomUUID(); return db.product.create({ data: { id, sku: id, slug: id, name: "Stock aislado", description: "Fixture", categoryId: category.id, priceClp: 9990, stock, active } }); };
    const a = await make(5), b = await make(1), inactive = await make(5, false);
    await changeCart(user.id, 0, "add", b.id, 1, db);
    const before = await readCart(user.id, db), mergeId = randomUUID();
    await assert.rejects(mergeCart(user.id, mergeId, [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }], db), { code: "STOCK_CONFLICT" });
    assert.deepEqual(await readCart(user.id, db), before);
    assert.equal(await db.cartMergeReceipt.count({ where: { id: mergeId } }), 0);
    await assert.rejects(mergeCart(user.id, randomUUID(), [{ productId: inactive.id, quantity: 1 }], db), { code: "PRODUCT_NOT_FOUND" });
    const quote = await quoteGuestCart([{ productId: a.id, quantity: 2 }, { productId: inactive.id, quantity: 1 }, { productId: randomUUID(), quantity: 1 }], db);
    assert.equal(quote.items[0].unitPriceClp, 9990);
    assert.equal(quote.items[0].subtotalClp, 19980);
    assert.equal(quote.items[1].available, false);
    assert.equal(quote.items[2].available, false);
    assert.equal(quote.items.length, 3); // Los ausentes se conservan para permitir eliminarlos.
    const big = await make(200);
    await changeCart(user.id, before.version, "add", big.id, 99, db);
    await assert.rejects(mergeCart(user.id, randomUUID(), [{ productId: big.id, quantity: 1 }], db), { code: "STOCK_CONFLICT" });
  } finally { await db.$disconnect(); }
});
