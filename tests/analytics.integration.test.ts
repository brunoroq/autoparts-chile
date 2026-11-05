import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { analyticsTestUrl } from "./analytics-database.ts";
import { claimPurchase } from "../src/lib/analytics/purchase.ts";
test("reclamación de compra atómica, autorización, valores persistidos y reinicio", async () => {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: analyticsTestUrl() }),
  });
  try {
    const user = await client.user.create({
        data: { email: randomUUID() + "@example.invalid" },
      }),
      other = await client.user.create({
        data: { email: randomUUID() + "@example.invalid" },
      });
    const product = await client.product.findFirstOrThrow();
    const o = await client.order.create({
      data: {
        userId: user.id,
        totalClp: 49980,
        idempotencyKey: randomUUID(),
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            unitPriceClp: 24990,
            quantity: 2,
          },
        },
      },
    });
    await assert.rejects(claimPurchase(other.id, o.id, client), {
      status: 404,
    });
    await assert.rejects(claimPurchase(user.id, o.id, client), {
      code: "ORDER_NOT_PAID",
    });
    await client.order.update({
      where: { id: o.id },
      data: { status: "PAID" },
    });
    const claims = await Promise.all([
      claimPurchase(user.id, o.id, client),
      claimPurchase(user.id, o.id, client),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    const event = claims.find(Boolean)!;
    assert.equal(event.value, 49980);
    assert.equal(event.transaction_id, o.id);
    assert.equal(event.items[0].price, 24990);
    const fresh = new PrismaClient({
      adapter: new PrismaPg({ connectionString: analyticsTestUrl() }),
    });
    try {
      assert.equal(await claimPurchase(user.id, o.id, fresh), null);
    } finally {
      await fresh.$disconnect();
    }
  } finally {
    await client.$disconnect();
  }
});
