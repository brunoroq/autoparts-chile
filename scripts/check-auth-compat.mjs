// Aplicación temporal aislada: comprueba la biblioteca antes de integrar usuarios reales.
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const dir = path.resolve("tmp/auth-compat");
const email = "compat@example.invalid";
const password = randomBytes(24).toString("hex");
const env = {
  ...process.env,
  NEXTAUTH_URL: "http://localhost:3103",
  NEXTAUTH_SECRET: randomBytes(48).toString("hex"),
  COMPAT_EMAIL: email,
  COMPAT_PASSWORD: password,
};
const files = {
  "package.json": JSON.stringify({ private: true, type: "module" }),
  "next.config.mjs": `export default { turbopack: { root: ${JSON.stringify(process.cwd())} } };`,
  "options.js": `import Credentials from 'next-auth/providers/credentials'; export const options={ session:{strategy:'jwt'}, providers:[Credentials({credentials:{email:{},password:{}}, async authorize(c){return c?.email===process.env.COMPAT_EMAIL && c?.password===process.env.COMPAT_PASSWORD ? {id:'compat-only',name:'Compatibilidad',email:c.email}:null;}})], callbacks:{async session({session,token}){session.user.id=token.sub;return session;}} };`,
  "app/layout.js": `export default function Layout({children}){return <html lang="es"><body>{children}</body></html>}`,
  "app/page.js": `import {getServerSession} from 'next-auth'; import {options} from '../options'; import Probe from './probe'; export const dynamic='force-dynamic'; export default async function Page(){const session=await getServerSession(options);return <><h1>Compatibilidad</h1><p id="server-user">{session?.user?.id || 'sin-sesion'}</p><Probe/></>}`,
  "app/probe.js": `'use client'; import {SessionProvider,useSession,signIn,signOut} from 'next-auth/react';function Form(){const {data}=useSession();return <><p id="client-user">{data?.user?.id || 'sin-sesion'}</p><form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await signIn('credentials',{email:f.get('email'),password:f.get('password'),callbackUrl:'/'});}}><input aria-label="Correo" name="email"/><input aria-label="Clave" type="password" name="password"/><button>Entrar</button></form><button onClick={()=>signOut({callbackUrl:'/'})}>Salir</button></>}export default function Probe(){return <SessionProvider><Form/></SessionProvider>}`,
  "app/api/auth/[...nextauth]/route.js": `import NextAuth from 'next-auth';import {options} from '../../../../options'; const handler=NextAuth(options);export {handler as GET,handler as POST};`,
};
for (const [name, content] of Object.entries(files)) {
  const target = path.join(dir, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}
execFileSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", dir],
  { env, stdio: "inherit" },
);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    dir,
    "--hostname",
    "127.0.0.1",
    "--port",
    "3103",
  ],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
try {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(env.NEXTAUTH_URL)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(env.NEXTAUTH_URL);
  assert.equal(await page.locator("#server-user").textContent(), "sin-sesion");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Clave").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#server-user")?.textContent === "compat-only",
  );
  await page.waitForFunction(
    () => document.querySelector("#client-user")?.textContent === "compat-only",
  );
  const sessionResponse = await page.request.get(
    `${env.NEXTAUTH_URL}/api/auth/session`,
  );
  assert.equal(sessionResponse.status(), 200);
  assert.equal((await sessionResponse.json()).user.id, "compat-only");
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name.endsWith("session-token"));
  assert.ok(sessionCookie?.httpOnly);
  assert.equal(sessionCookie.sameSite, "Lax");
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#server-user")?.textContent === "sin-sesion",
  );
  assert.deepEqual(errors, []);
  console.log(
    "COMPATIBILIDAD CORRECTA: build, React 19, Credentials/CSRF, JWT, getServerSession, cookies y logout reales.",
  );
} finally {
  await browser?.close();
  server.kill();
}
