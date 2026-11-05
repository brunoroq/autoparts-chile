import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  checkoutInput,
  scenarioInput,
} from "../src/modules/orders/validation.ts";
import {
  decryptToken,
  encryptToken,
  paymentProvider,
  tokenHash,
  webpayGateway,
} from "../src/modules/payments/providers.ts";

test("contratos de checkout rechazan precios, versiones y escenarios manipulados", () => {
  assert.deepEqual(checkoutInput({ cartVersion: 0 }, "a".repeat(16)), {
    version: 0,
    key: "a".repeat(16),
  });
  for (const body of [
    { cartVersion: -1 },
    { cartVersion: 1.5 },
    { cartVersion: 1, totalClp: 1 },
    { cartVersion: "1" },
  ])
    assert.throws(() => checkoutInput(body, "a".repeat(16)));
  assert.throws(() => checkoutInput({ cartVersion: 0 }, null));
  assert.throws(() =>
    scenarioInput({ scenario: "approved", provider: "WEBPAY_INTEGRATION" }),
  );
  assert.throws(() => scenarioInput({ scenario: "forged" }));
});

test("configuración impide producción y cifrado autenticado detecta manipulación", () => {
  const previous = {
    mode: process.env.PAYMENT_PROVIDER,
    environment: process.env.WEBPAY_ENVIRONMENT,
    secret: process.env.PAYMENT_TOKEN_SECRET,
  };
  try {
    process.env.PAYMENT_PROVIDER = "production";
    assert.throws(paymentProvider);
    process.env.PAYMENT_PROVIDER = "simulated";
    process.env.WEBPAY_ENVIRONMENT = "production";
    assert.throws(paymentProvider);
    process.env.WEBPAY_ENVIRONMENT = "integration";
    process.env.PAYMENT_PROVIDER = "webpay_integration";
    delete process.env.PAYMENT_TOKEN_SECRET;
    assert.throws(paymentProvider);
    process.env.PAYMENT_TOKEN_SECRET = randomBytes(32).toString("hex");
    assert.equal(paymentProvider(), "WEBPAY_INTEGRATION");
    const token = randomBytes(32).toString("hex"),
      encrypted = encryptToken(token);
    assert.equal(decryptToken(encrypted), token);
    assert.ok(!encrypted.includes(token));
    assert.equal(tokenHash(token).length, 64);
    const altered = Buffer.from(encrypted, "base64");
    altered[30] ^= 1;
    assert.throws(() => decryptToken(altered.toString("base64")));
  } finally {
    for (const [key, value] of Object.entries({
      PAYMENT_PROVIDER: previous.mode,
      WEBPAY_ENVIRONMENT: previous.environment,
      PAYMENT_TOKEN_SECRET: previous.secret,
    }))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});

test("adaptador Webpay: lista permitida de datos, redirección y reversa verificadas sin red", async () => {
  const previous = {
    secret: process.env.PAYMENT_TOKEN_SECRET,
    base: process.env.NEXTAUTH_URL,
    mode: process.env.PAYMENT_PROVIDER,
    environment: process.env.WEBPAY_ENVIRONMENT,
  };
  try {
    process.env.PAYMENT_PROVIDER = "simulated";
    process.env.WEBPAY_ENVIRONMENT = "integration";
    process.env.PAYMENT_TOKEN_SECRET = randomBytes(32).toString("hex");
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    let response: Record<string, unknown> = {
      status: "AUTHORIZED",
      amount: 123,
      buy_order: "APtest",
      session_id: "random",
      response_code: 0,
      card_detail: { card_number: "0000" },
    };
    const transport = {
      async create() {
        return response;
      },
      async commit() {
        return response;
      },
      async status() {
        return response;
      },
      async refund() {
        return response;
      },
    };
    const gateway = webpayGateway(transport),
      input = {
        amountClp: 123,
        externalReference: "APtest",
        sessionId: "random",
        tokenCipher: encryptToken("test-only-token"),
        simulatedOutcome: null,
      };
    const verified = await gateway.commit(input);
    assert.equal(verified.state, "AUTHORIZED");
    assert.ok(!JSON.stringify(verified).includes("card"));
    response = {
      token: "a".repeat(64),
      url: "https://webpay3g.transbank.cl/webpayserver/initTransaction",
    };
    await assert.rejects(gateway.create(input));
    response = {
      token: "a".repeat(64),
      url: "https://webpay3gint.transbank.cl/webpayserver/initTransaction",
    };
    assert.equal((await gateway.create(input)).token, "a".repeat(64));
    response = {
      type: "NULLIFIED",
      response_code: 0,
      nullified_amount: 122,
      balance: 0,
    };
    assert.equal(await gateway.refund(input), "UNCONFIRMED");
    response = {
      type: "NULLIFIED",
      response_code: 0,
      nullified_amount: 123,
      balance: 0,
    };
    assert.equal(await gateway.refund(input), "NULLIFIED");
    response = { type: "REVERSED" };
    assert.equal(await gateway.refund(input), "REVERSED");
  } finally {
    for (const [key, value] of Object.entries({
      PAYMENT_TOKEN_SECRET: previous.secret,
      NEXTAUTH_URL: previous.base,
      PAYMENT_PROVIDER: previous.mode,
      WEBPAY_ENVIRONMENT: previous.environment,
    }))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});
