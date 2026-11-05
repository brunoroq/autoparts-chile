import "dotenv/config";
import { authTestUrl } from "./auth-database.ts";
export function checkoutTestUrl() {
  const url = new URL(authTestUrl());
  url.pathname = "/autoparts_checkout_test";
  return url.toString();
}
