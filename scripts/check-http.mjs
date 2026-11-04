import assert from "node:assert/strict";

const baseUrl = "http://localhost:3000";
const response = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) });
assert.equal(response.status, 200);
const html = await response.text();
assert.match(html, /<title>AutoParts Chile/);
assert.match(html, /lang="es-CL"/);
assert.match(html, /El punto de partida para medir y mejorar/);
const stylesheets = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)];
assert.ok(stylesheets.length > 0, "La página debe cargar CSS.");
for (const [, href] of stylesheets) {
  const cssResponse = await fetch(new URL(href, baseUrl), { signal: AbortSignal.timeout(10000) });
  assert.equal(cssResponse.status, 200);
  assert.match(await cssResponse.text(), /min-h-screen/);
}
console.log("HTTP 200 en localhost:3000. Título, idioma, contenido y CSS de Tailwind verificados.");
