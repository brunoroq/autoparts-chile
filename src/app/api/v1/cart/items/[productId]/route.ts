import { apiResponse } from "@/lib/observability/request";
import { requireUser } from "@/lib/auth/session";
import { checkOrigin, readJson } from "@/lib/http/input";
import {
  cartBody,
  cartVersion,
  productIdInput,
} from "@/modules/cart/validation";
import { changeCart } from "@/modules/cart/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ productId: string }> };
function run(request: Request, context: Context, remove: boolean) {
  return apiResponse(
    "/api/v1/cart/items/[productId]",
    request.method,
    async (response) => {
      const user = await requireUser();
      checkOrigin(request);
      const version = cartVersion(request.headers.get("if-match"));
      const { productId } = await context.params;
      productIdInput(productId);
      const quantity = remove
        ? undefined
        : cartBody(await readJson(request), false).quantity;
      const data = await changeCart(
        user.id,
        version,
        remove ? "remove" : "set",
        productId,
        quantity,
      );
      response.headers.set("ETag", `"${data.version}"`);
      return { data };
    },
  );
}
export const PATCH = (request: Request, context: Context) =>
  run(request, context, false);
export const DELETE = (request: Request, context: Context) =>
  run(request, context, true);
