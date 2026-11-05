import { apiResponse } from "@/lib/observability/request";
import { requireUser } from "@/lib/auth/session";
import { checkOrigin, readJson } from "@/lib/http/input";
import { cartBody, cartVersion } from "@/modules/cart/validation";
import { changeCart } from "@/modules/cart/service";

export const runtime = "nodejs";
export function POST(request: Request) {
  return apiResponse("/api/v1/cart/items", "POST", async (context) => {
    const user = await requireUser();
    checkOrigin(request);
    const version = cartVersion(request.headers.get("if-match"));
    const body = cartBody(await readJson(request), true);
    const data = await changeCart(
      user.id,
      version,
      "add",
      body.productId!,
      body.quantity,
    );
    context.status = 201;
    context.headers.set("ETag", `"${data.version}"`);
    return { data };
  });
}
