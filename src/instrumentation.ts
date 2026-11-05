import { experimentContext } from "./lib/observability/config";
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startResourceSampler } = await import(
      "./lib/observability/resources"
    );
    startResourceSampler();
  }
}
export async function onRequestError() {
  console.log(
    JSON.stringify({
      event: "render_error",
      ...experimentContext(),
      timestamp: new Date().toISOString(),
      code: "NEXT_REQUEST_ERROR",
    }),
  );
}
