import type { AnalyticsConfig } from "../analytics/contracts";
import { validSyntheticId } from "../analytics/synthetic";
const label = (value: string | undefined, fallback: string) =>
  value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : fallback;
export function experimentContext() {
  return {
    environment: label(process.env.APP_ENV, "local"),
    experimentId: label(process.env.EXPERIMENT_ID, "baseline"),
    traffic:
      process.env.TRAFFIC_KIND === "synthetic"
        ? ("synthetic" as const)
        : ("human" as const),
    catalogSize: label(process.env.CATALOG_SIZE, "unspecified"),
    concurrency: label(process.env.EXPERIMENT_CONCURRENCY, "unspecified"),
  };
}
export function analyticsConfig(): AnalyticsConfig {
  const context = experimentContext();
  // Un laboratorio mal etiquetado no debe caer en la propiedad humana.
  const lab = process.env.PERF_ISOLATED === 'true' || context.environment === 'performance-local';
  const id =
    context.traffic === "synthetic"
      ? process.env.GA4_SYNTHETIC_MEASUREMENT_ID
      : process.env.GA4_MEASUREMENT_ID;
  const measurementId = id && /^G-[A-Z0-9]{5,20}$/.test(id) ? id : "";
  const separated =
    (context.traffic !== "synthetic" || validSyntheticId(id, process.env.GA4_MEASUREMENT_ID)) &&
    (!lab || (context.traffic === 'synthetic' && process.env.PERF_BROWSER_ANALYTICS === 'true'));
  const origin = new URL(process.env.NEXTAUTH_URL || "http://localhost:3000")
    .origin;
  return {
    ...context,
    origin,
    measurementId: separated ? measurementId : "",
    enabled:
      process.env.ANALYTICS_ENABLED === "true" && !!measurementId && separated,
    vitals: process.env.WEB_VITALS_ENABLED === "true",
    debug: process.env.GA4_DEBUG === "true",
  };
}
