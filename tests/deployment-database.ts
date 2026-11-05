import "dotenv/config";
export function deploymentDatabase(
  kind: "base" | "auth" | "checkout" | "analytics" | "catalog" | "bootstrap",
) {
  if (!process.env.DATABASE_URL)
    throw new Error("Falta conexión local administrativa.");
  const url = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error(
      "La verificación de despliegue solo permite bases locales _test.",
    );
  url.pathname = `/autoparts_deploy_${kind}_test`;
  return url.toString();
}
export function deploymentEnvironment() {
  return {
    ...process.env,
    TEST_DATABASE_URL: deploymentDatabase("catalog"),
    AUTH_TEST_DATABASE_URL: deploymentDatabase("auth"),
    CHECKOUT_TEST_DATABASE_URL: deploymentDatabase("checkout"),
    ANALYTICS_TEST_DATABASE_URL: deploymentDatabase("analytics"),
    ANALYTICS_ENABLED: "false",
    WEB_VITALS_ENABLED: "false",
    RESOURCE_METRICS_ENABLED: "false",
    PAYMENT_PROVIDER: "simulated",
    WEBPAY_ENVIRONMENT: "integration",
    VERCEL: undefined,
  };
}
