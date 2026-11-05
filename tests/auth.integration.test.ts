import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { authTestUrl } from "./auth-database.ts";
import {
  registerUser,
  authenticateUser,
} from "../src/modules/users/service.ts";
import { readCart, changeCart } from "../src/modules/cart/service.ts";

test("registro concurrente, aislamiento, persistencia, stock y CAS atómico reales", async () => {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: authTestUrl(), max: 5 }),
  });
  const password = randomBytes(20).toString("hex");
  const input = (email: string) => ({
    name: "Prueba aislada",
    email,
    password,
    confirmPassword: password,
  });
  const email = `${randomUUID()}@example.invalid`;
  const product = await client.product.findFirstOrThrow({
    where: { active: true, stock: { gte: 3 } },
  });
  let second: PrismaClient | undefined;
  try {
    const registrations = await Promise.allSettled([
      registerUser(input(email), client),
      registerUser(input(email.toUpperCase()), client),
    ]);
    assert.equal(
      registrations.filter((r) => r.status === "fulfilled").length,
      1,
    );
    assert.equal(
      registrations.filter(
        (r) => r.status === "rejected" && r.reason.status === 409,
      ).length,
      1,
    );
    assert.equal(await client.user.count({ where: { email } }), 1);
    const a = await authenticateUser(email, password, client);
    assert.ok(a);
    assert.ok(!("passwordHash" in a));
    assert.equal(await authenticateUser(email, password + "x", client), null);
    const b = await registerUser(
      input(`${randomUUID()}@example.invalid`),
      client,
    );
    assert.equal((await readCart(a.id, client)).version, 0);
    const writes = await Promise.allSettled([
      changeCart(a.id, 0, "add", product.id, 1, client),
      changeCart(a.id, 0, "add", product.id, 1, client),
    ]);
    assert.equal(writes.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      writes.filter(
        (r) => r.status === "rejected" && r.reason.code === "CART_CONFLICT",
      ).length,
      1,
    );
    const saved = await readCart(a.id, client);
    assert.equal(saved.version, 1);
    assert.equal(saved.items[0].quantity, 1);
    assert.equal((await readCart(b.id, client)).items.length, 0);
    await assert.rejects(
      changeCart(b.id, 0, "remove", product.id, undefined, client),
      { status: 404 },
    );
    await assert.rejects(changeCart(a.id, 1, "set", product.id, 99, client), {
      code: "STOCK_CONFLICT",
    });
    assert.equal((await readCart(a.id, client)).version, 1); // rollback también de versión
    await changeCart(a.id, 1, "set", product.id, 2, client);
    assert.equal(
      (await client.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stock,
      product.stock,
    );
    second = new PrismaClient({
      adapter: new PrismaPg({ connectionString: authTestUrl() }),
    });
    assert.equal((await readCart(a.id, second)).items[0].quantity, 2);
    await client.product.update({
      where: { id: product.id },
      data: { stock: 0, priceClp: product.priceClp + 100, active: false },
    });
    const changed = await readCart(a.id, client);
    assert.equal(changed.items.length, 1);
    assert.equal(changed.items[0].available, false);
    assert.equal(changed.totalClp, (product.priceClp + 100) * 2);
    await assert.rejects(changeCart(a.id, 2, "add", product.id, 1, client), {
      status: 404,
    });
    await changeCart(a.id, 2, "remove", product.id, undefined, client);
    assert.equal((await readCart(a.id, client)).items.length, 0);
  } finally {
    await client.product.update({
      where: { id: product.id },
      data: {
        stock: product.stock,
        priceClp: product.priceClp,
        active: product.active,
      },
    });
    await second?.$disconnect();
    await client.$disconnect();
  }
});
