import { apiResponse } from "@/lib/observability/request";
import { requireUser } from "@/lib/auth/session";
import { readCart } from "@/modules/cart/service";
import { ApiError } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET(request: Request) {
  return apiResponse("/api/v1/cart", "GET", async (context) => {
    const user = await requireUser();
    if (new URL(request.url).search)
      throw new ApiError(
        "El carrito se obtiene desde tu sesión, sin parámetros.",
      );
    const data = await readCart(user.id);
    context.headers.set("ETag", `"${data.version}"`);
    return { data };
  });
}
