export const runtime = "nodejs";
import { requireUser } from "@/lib/auth/session";
import { checkOrigin } from "@/lib/http/input";
import { ApiError } from "@/lib/http/errors";
import { apiResponse } from "@/lib/observability/request";
import { analyticsConfig } from "@/lib/observability/config";
import { productIdInput } from "@/modules/cart/validation";
import { claimPurchase } from "@/lib/analytics/purchase";
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return apiResponse(
    "/api/v1/orders/[id]/analytics-purchase",
    "POST",
    async () => {
      checkOrigin(request);
      const user = await requireUser();
      if (!analyticsConfig().enabled)
        throw new ApiError("Analítica desactivada.", 409, "ANALYTICS_DISABLED");
      if (request.headers.get("X-Analytics-Consent") !== "granted")
        throw new ApiError(
          "Se requiere consentimiento.",
          403,
          "CONSENT_REQUIRED",
        );
      return {
        data: await claimPurchase(
          user.id,
          productIdInput((await context.params).id),
        ),
      };
    },
  );
}
