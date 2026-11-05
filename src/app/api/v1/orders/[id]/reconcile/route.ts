import { requireUser } from "@/lib/auth/session";
import { checkOrigin } from "@/lib/http/input";
import { productIdInput } from "@/modules/cart/validation";
import { apiResponse } from "@/lib/observability/request";
import { readOrder, processPayment } from "@/modules/orders/service";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return apiResponse("/api/v1/orders/[id]/reconcile", "POST", async () => {
    checkOrigin(request);
    const user = await requireUser();
    const order = await readOrder(
      user.id,
      productIdInput((await context.params).id),
    );
    return {
      data: order.payment
        ? await processPayment(user.id, order.payment.id, "reconcile")
        : order,
    };
  });
}
