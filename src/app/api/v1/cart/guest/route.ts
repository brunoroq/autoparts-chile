import { apiResponse } from "@/lib/observability/request";
import { checkOrigin, exactFields, readJson } from "@/lib/http/input";
import { guestItems } from "@/modules/cart/guest-validation";
import { quoteGuestCart } from "@/modules/cart/guest-quote";

export const runtime = "nodejs";
export function POST(request: Request) {
  return apiResponse("/api/v1/cart/guest", "POST", async () => {
    checkOrigin(request);
    const body = await readJson(request);
    exactFields(body, ["items"]);
    return { data: await quoteGuestCart(guestItems(body.items)) };
  });
}
