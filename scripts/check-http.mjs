import assert from "node:assert/strict";

const baseUrl = "http://localhost:3000";
const response = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) });
assert.equal(response.status, 200);
const html = await response.text();
assert.match(html, /<title>AutoParts Chile/);
assert.match(html, /lang="es-CL"/);
assert.match(html, /Equipa tu auto/);
const stylesheets = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)];
assert.ok(stylesheets.length > 0, "La página debe cargar CSS.");
for (const [, href] of stylesheets) {
  const cssResponse = await fetch(new URL(href, baseUrl), {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(cssResponse.status, 200);
  assert.match(await cssResponse.text(), /\.hero/);
}
for (const path of ["/catalogo", "/api/v1/products", "/api/v1/categories"]) {
  assert.equal((await fetch(new URL(path, baseUrl))).status, 200);
}
const products = await (await fetch(`${baseUrl}/api/v1/products`)).json();
assert.ok(products.data.length > 0);
assert.equal(
  (await fetch(`${baseUrl}/productos/${products.data[0].slug}`)).status,
  200,
);
const optimizedImage = await fetch(
  `${baseUrl}/_next/image?url=%2Fimages%2Fproducts%2Fproduct-01.webp&w=640&q=75`,
);
assert.equal(optimizedImage.status, 200);
assert.match(optimizedImage.headers.get("content-type"), /image\//);
console.log(
  "Inicio, catálogo, detalle, API y optimización de imágenes: HTTP 200.",
);
