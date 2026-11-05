import "dotenv/config";
import { authTestUrl } from "./auth-database.ts";
export function checkoutTestUrl() {
  const url = new URL(process.env.CHECKOUT_TEST_DATABASE_URL || authTestUrl());
  if (!process.env.CHECKOUT_TEST_DATABASE_URL)
    url.pathname = "/autoparts_checkout_test";
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname)
  )
    throw new Error("Checkout: pruebas solo en base local terminada en _test.");
  return url.toString();
}
