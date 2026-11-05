export const runtime = "nodejs";
import { requireUser } from "@/lib/auth/session";
import { checkOrigin, readJson } from "@/lib/http/input";
import { ApiError } from "@/lib/http/errors";
import { productIdInput } from "@/modules/cart/validation";
import { apiResponse } from "@/lib/observability/request";
import { processPayment } from "@/modules/orders/service";
import { scenarioInput } from "@/modules/orders/validation";
import { prisma } from "@/lib/db/prisma";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return apiResponse(
    "/api/v1/payments/[id]/simulate",
    "POST",
    async ({ db }) => {
      checkOrigin(request);
      const user = await requireUser();
      const id = productIdInput((await context.params).id);
      const p = await db(() =>
        prisma.paymentAttempt.findFirst({
          where: { id, order: { userId: user.id }, provider: "SIMULATED" },
          select: { id: true },
        }),
      );
      if (!p)
        throw new ApiError(
          "Pago simulado no encontrado.",
          404,
          "PAYMENT_NOT_FOUND",
        );
      return {
        data: await processPayment(
          user.id,
          id,
          "commit",
          scenarioInput(await readJson(request)),
        ),
      };
    },
  );
}
