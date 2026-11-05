import { AsyncLocalStorage } from "node:async_hooks";
import { ApiError } from "../http/errors";

type Metric = "db" | "auth" | "hash" | "provider";
type Metrics = Record<Metric, number>;
export type RequestContext = {
  db: <T>(operation: () => Promise<T>) => Promise<T>;
  status: number;
  headers: Headers;
};
const storage = new AsyncLocalStorage<Metrics>();

export async function measure<T>(name: Metric, operation: () => Promise<T>) {
  const start = performance.now();
  try {
    return await operation();
  } finally {
    const metrics = storage.getStore();
    if (metrics) metrics[name] += performance.now() - start;
  }
}

export async function instrumentResponse(
  route: string,
  method: string,
  operation: () => Promise<Response>,
) {
  const start = performance.now();
  const requestId = crypto.randomUUID();
  const metrics: Metrics = { db: 0, auth: 0, hash: 0, provider: 0 };
  let errorCode: string | undefined;
  return storage.run(metrics, async () => {
    let response: Response;
    try {
      response = await operation();
    } catch (error) {
      const known = error instanceof ApiError;
      errorCode = known ? error.code : "INTERNAL_ERROR";
      response = Response.json(
        {
          error: {
            code: errorCode,
            message: known
              ? error.message
              : "No pudimos completar la operación. Intenta nuevamente.",
            requestId,
          },
        },
        { status: known ? error.status : 500 },
      );
      if (known && error.retryAfter)
        response.headers.set("Retry-After", String(error.retryAfter));
    }
    const totalMs = performance.now() - start;
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Request-Id", requestId);
    response.headers.set(
      "Server-Timing",
      `app;dur=${totalMs.toFixed(2)}, db;dur=${metrics.db.toFixed(2)}, auth;dur=${metrics.auth.toFixed(2)}, hash;dur=${metrics.hash.toFixed(2)}, provider;dur=${metrics.provider.toFixed(2)}`,
    );
    console.log(
      JSON.stringify({
        event: "api_request",
        timestamp: new Date().toISOString(),
        requestId,
        route,
        method,
        status: response.status,
        totalMs: +totalMs.toFixed(2),
        dbMs: +metrics.db.toFixed(2),
        authMs: +metrics.auth.toFixed(2),
        hashMs: +metrics.hash.toFixed(2),
        providerMs: +metrics.provider.toFixed(2),
        ...(errorCode ? { error: errorCode } : {}),
      }),
    );
    return response;
  });
}

export function apiResponse(
  route: string,
  method: string,
  operation: (context: RequestContext) => Promise<unknown>,
) {
  return instrumentResponse(route, method, async () => {
    const context: RequestContext = {
      status: 200,
      headers: new Headers(),
      db: (operation) => measure("db", operation),
    };
    const data = await operation(context);
    return Response.json(data, {
      status: context.status,
      headers: context.headers,
    });
  });
}

export const catalogResponse = (
  route: string,
  operation: (context: RequestContext) => Promise<unknown>,
) => apiResponse(route, "GET", operation);
