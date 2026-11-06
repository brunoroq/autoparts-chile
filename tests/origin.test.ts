import test from "node:test";
import assert from "node:assert/strict";
import { checkOrigin } from "../src/lib/http/input";

const stable = "https://autoparts-chile.vercel.app";
test("origen canónico y proxy Vercel: reproduce dominio antiguo y rechaza terceros", () => {
  const previous = { url: process.env.NEXTAUTH_URL, vercel: process.env.VERCEL };
  const request = (headers: Record<string, string> = {}, method = "POST") => new Request("http://internal-proxy:3000/api/v1/cart/guest", {
    method, headers: { origin: stable, host: "autoparts-chile.vercel.app", "x-forwarded-host": "autoparts-chile.vercel.app", ...headers },
  });
  try {
    process.env.VERCEL = "1";
    process.env.NEXTAUTH_URL = "https://autoparts-store.vercel.app";
    assert.throws(() => checkOrigin(request()), { status: 403, code: "INVALID_ORIGIN" });
    process.env.NEXTAUTH_URL = stable;
    assert.doesNotThrow(() => checkOrigin(request()));
    for (const origin of ["https://third-party.invalid", "https://preview-other.vercel.app", "http://autoparts-chile.vercel.app", "null", stable + "/", stable + ".evil.invalid", stable + ", https://evil.invalid"])
      assert.throws(() => checkOrigin(request({ origin })), { status: 403 });
    const absent = request(); absent.headers.delete("origin");
    assert.throws(() => checkOrigin(absent), { status: 403 });
    for (const host of ["evil.invalid", "autoparts-chile.vercel.app.evil.invalid", "autoparts-chile.vercel.app, evil.invalid"])
      for (const name of ["host", "x-forwarded-host"])
        assert.throws(() => checkOrigin(request({ [name]: host })), { status: 403 });
    assert.throws(() => checkOrigin(request({ "sec-fetch-site": "cross-site" })), { status: 403 });
    assert.doesNotThrow(() => checkOrigin(request({ "sec-fetch-site": "same-origin" })));
    for (const method of ["GET", "HEAD", "OPTIONS"])
      assert.doesNotThrow(() => checkOrigin(new Request(stable, { method })));
    for (const url of [undefined, "invalid", stable + "/private", stable + "?token=x", "https://user:password@autoparts-chile.vercel.app", "http://localhost:3000"]){
      if (url === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = url;
      assert.throws(() => checkOrigin(request()), { status: 500, code: "CONFIGURATION_ERROR" });
    }
    delete process.env.VERCEL;
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    assert.doesNotThrow(() => checkOrigin(new Request("http://localhost:3000/api/v1/cart/guest", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" } })));
    assert.throws(() => checkOrigin(new Request("http://localhost:3000/api/v1/cart/guest", { method: "POST", headers: { origin: "http://localhost:3002" } })), { status: 403 });
  } finally {
    if (previous.url === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = previous.url;
    if (previous.vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous.vercel;
  }
});
