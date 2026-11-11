import test from "node:test";
import assert from "node:assert/strict";
import { checkOrigin } from "../src/lib/http/input";

const stable = "https://autoparts-chile.vercel.app";
function withCanonicalOrigin(check: () => void) {
  const previous = { url: process.env.NEXTAUTH_URL, vercel: process.env.VERCEL };
  process.env.NEXTAUTH_URL = stable; process.env.VERCEL = "1";
  try { check(); } finally {
    if (previous.url === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = previous.url;
    if (previous.vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous.vercel;
  }
}
function withoutOrigin(overrides: Record<string, string | null> = {}, method = "POST") {
  const headers = new Headers({ host: "autoparts-chile.vercel.app", "x-forwarded-host": "autoparts-chile.vercel.app" });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) headers.delete(key); else headers.set(key, value);
  }
  return new Request("http://internal-proxy:3000/api/v1/cart/guest", { method, headers });
}
test("Origin ausente solo acepta Fetch Metadata same-origin o Referer canónico sin metadatos", () => withCanonicalOrigin(() => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.doesNotThrow(() => checkOrigin(withoutOrigin({ "sec-fetch-site": "same-origin" }, method)));
    assert.doesNotThrow(() => checkOrigin(withoutOrigin({ referer: stable + "/productos/fixture?q=example" }, method)));
  }
  assert.doesNotThrow(() => checkOrigin(withoutOrigin({ "sec-fetch-site": "same-origin", referer: stable + "/carrito" })));
}));
test("rechaza Origin opaco, terceros, señales contradictorias y ausencia de evidencia", () => withCanonicalOrigin(() => {
  const reject = (headers: Record<string, string | null>) => assert.throws(() => checkOrigin(withoutOrigin(headers)), { status: 403, code: "INVALID_ORIGIN" });
  reject({}); // Host y X-Forwarded-Host nunca bastan para acreditar el origen.
  for (const site of ["cross-site", "same-site", "none", "invalid"])
    reject({ "sec-fetch-site": site, referer: stable + "/carrito" });
  for (const origin of ["null", "", "https://evil.invalid", stable + ".evil.invalid"])
    reject({ origin, "sec-fetch-site": "same-origin", referer: stable + "/carrito" });
  for (const referer of ["null", "invalid", "/carrito", stable + ".evil.invalid/path", "http://autoparts-chile.vercel.app/path", "https://user:password@autoparts-chile.vercel.app/path", "https://autoparts-chile.vercel.app:444/path"]) {
    reject({ referer }); reject({ referer, "sec-fetch-site": "same-origin" });
  }
  reject({ host: null, "sec-fetch-site": "same-origin" });
  reject({ host: null, referer: stable + "/carrito" });
  for (const name of ["host", "x-forwarded-host"]) {
    for (const host of ["evil.invalid", "autoparts-chile.vercel.app.evil.invalid", "autoparts-chile.vercel.app, evil.invalid"]) {
      reject({ [name]: host, "sec-fetch-site": "same-origin" });
      reject({ [name]: host, referer: stable + "/carrito" });
    }
  }
}));
test("fallback local respeta puertos y no acepta un forwarded host inconsistente", () => withCanonicalOrigin(() => {
  delete process.env.VERCEL; process.env.NEXTAUTH_URL = "http://localhost:3019";
  const request = (extra: Record<string, string> = {}) => new Request("http://localhost:3019/api/v1/cart/guest", { method: "POST", headers: { host: "localhost:3019", "sec-fetch-site": "same-origin", ...extra } });
  assert.doesNotThrow(() => checkOrigin(request()));
  assert.throws(() => checkOrigin(request({ host: "localhost:3000" })), { status: 403 });
  assert.throws(() => checkOrigin(request({ "x-forwarded-host": "evil.invalid" })), { status: 403 });
}));
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
