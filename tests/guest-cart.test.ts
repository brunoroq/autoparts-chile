import test from "node:test";
import assert from "node:assert/strict";
import { guestItems } from "../src/modules/cart/guest-validation";
import { parseGuestCart } from "../src/lib/cart/guest-storage";

const id = "00000000-0000-4000-a000-000000000001";
test("carrito invitado: solo IDs/cantidades, sin confiar en precios guardados", () => {
  assert.deepEqual(guestItems([{ productId: id, quantity: 2 }]), [{ productId: id, quantity: 2 }]);
  for (const quantity of [0, -1, 1.5, 100, "2", null])
    assert.throws(() => guestItems([{ productId: id, quantity }]));
  assert.throws(() => guestItems([{ productId: id, quantity: 1, priceClp: 1 }]));
  assert.throws(() => guestItems([{ productId: id, quantity: 1 }, { productId: id, quantity: 2 }]));
  assert.throws(() => guestItems(Array(51).fill({ productId: id, quantity: 1 })));
});
test("persistencia: carga inicial vacía, recarga y fusión pendiente estable", () => {
  assert.deepEqual(parseGuestCart(null), { items: [] });
  const items = [{ productId: id, quantity: 2 }];
  const saved = { items, pending: { id, userId: id, items } };
  assert.deepEqual(parseGuestCart(JSON.stringify(saved)), saved);
  assert.throws(() => parseGuestCart("malformed"));
  assert.throws(() => parseGuestCart(JSON.stringify({ ...saved, items: [{ productId: id, quantity: 3 }] })));
});
