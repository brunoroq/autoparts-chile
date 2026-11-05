import { requireUser } from "@/lib/auth/session";
import { productIdInput } from "@/modules/cart/validation";
import { apiResponse } from "@/lib/observability/request";
import { readOrder } from "@/modules/orders/service";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return apiResponse("/api/v1/orders/[id]", "GET", async () => {
    const user = await requireUser();
    return {
      data: await readOrder(user.id, productIdInput((await context.params).id)),
    };
  });
}
