import { ApiError } from "../../lib/http/errors";
import { exactFields } from "../../lib/http/input";
import { scenarios, type Scenario } from "../payments/providers";
export function checkoutInput(
  body: Record<string, unknown>,
  key: string | null,
) {
  exactFields(body, ["cartVersion"]);
  if (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key))
    throw new ApiError(
      "Envía Idempotency-Key con 16 a 128 caracteres seguros.",
    );
  if (
    !Number.isInteger(body.cartVersion) ||
    (body.cartVersion as number) < 0 ||
    (body.cartVersion as number) >= 2147483647
  )
    throw new ApiError("Versión de carrito inválida.");
  return { version: body.cartVersion as number, key };
}
export function scenarioInput(body: Record<string, unknown>): Scenario {
  exactFields(body, ["scenario"]);
  if (!scenarios.includes(body.scenario as Scenario))
    throw new ApiError("Escenario de simulación inválido.");
  return body.scenario as Scenario;
}
