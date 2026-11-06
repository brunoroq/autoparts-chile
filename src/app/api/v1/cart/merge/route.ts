import { requireUser } from "@/lib/auth/session";
import { checkOrigin, exactFields, readJson } from "@/lib/http/input";
import { apiResponse } from "@/lib/observability/request";
import { productIdInput } from "@/modules/cart/validation";
import { mergeCart } from "@/modules/cart/merge";

export const runtime = "nodejs";
export function POST(request: Request) {
  return apiResponse("/api/v1/cart/merge", "POST", async context => {
    const user = await requireUser();
    checkOrigin(request);
    const body = await readJson(request);
    exactFields(body, ["mergeId", "items"]);
    const data = await mergeCart(user.id, productIdInput(body.mergeId), body.items);
    context.headers.set("ETag", `"${data.version}"`);
    // No add_to_cart: las adiciones originales ya se midieron en el navegador.
    return { data };
  });
}
