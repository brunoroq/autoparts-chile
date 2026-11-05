export const runtime = "nodejs";
import { requireUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { apiResponse } from "@/lib/observability/request";
import { listOrders } from "@/modules/orders/service";
export async function GET(request: Request) {
  return apiResponse("/api/v1/orders", "GET", async () => {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    if (
      [...params.keys()].some((k) => k !== "page") ||
      params.getAll("page").length > 1 ||
      !/^[1-9]\d{0,4}$/.test(params.get("page") || "1")
    )
      throw new ApiError("Página inv?lida.");
    return { data: await listOrders(user.id, Number(params.get("page") || 1)) };
  });
}
