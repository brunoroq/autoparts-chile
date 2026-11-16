import { randomBytes } from "node:crypto";
import { encryptToken } from "../../src/modules/payments/providers";
import { GET, POST } from "../../src/app/api/v1/payments/webpay/return/route";
import { state, token } from "./webpay-return-memory";

// Se ejecuta solo en el bundle de prueba con DB/SDK sustituidos por dobles.
export async function exercise(method: "GET" | "POST") {
  process.env.PAYMENT_TOKEN_SECRET = randomBytes(32).toString("hex");
  state.payment.tokenCipher = encryptToken(token);
  const path = "http://127.0.0.1:3004/api/v1/payments/webpay/return";
  const first = method === "GET"
    ? await GET(new Request(path + "?token_ws=" + token))
    : await POST(new Request(path, { method: "POST", body: new URLSearchParams({ token_ws: token }) }));
  const duplicate = await POST(new Request(path, {
    method: "POST", body: new URLSearchParams({ token_ws: token }),
  }));
  const repeated = await GET(new Request(path + "?token_ws=" + token));
  const invalid = await POST(new Request(path, {
    method: "POST", body: new URLSearchParams({ token_ws: [token, token].join("!") }),
  }));
  return { responses: [first, duplicate, repeated], invalid, state };
}
