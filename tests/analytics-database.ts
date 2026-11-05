import "dotenv/config";
import { authTestUrl } from "./auth-database.ts";
export function analyticsTestUrl() {
  const url = new URL(authTestUrl());
  url.pathname = "/autoparts_analytics_test";
  return url.toString();
}
