import { requireUser } from "@/lib/auth/session";
import { checkOrigin, readJson } from "@/lib/http/input";
import { apiResponse } from "@/lib/observability/request";
import { checkout } from "@/modules/orders/service";
import { checkoutInput } from "@/modules/orders/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return apiResponse("/api/v1/checkout", "POST", async () => {
    checkOrigin(request);
    const user = await requireUser();
    const { version, key } = checkoutInput(
      await readJson(request),
      request.headers.get("Idempotency-Key"),
    );
    return { data: await checkout(user.id, version, key) };
  });
}
