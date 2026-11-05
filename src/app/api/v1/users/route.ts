import { apiResponse } from "@/lib/observability/request";
import { checkOrigin, readJson } from "@/lib/http/input";
import { limitAttempt } from "@/lib/auth/rate-limit";
import { registerUser } from "@/modules/users/service";
import { normalizeEmail } from "@/modules/users/validation";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return apiResponse("/api/v1/users", "POST", async (context) => {
    checkOrigin(request);
    const body = await readJson(request);
    limitAttempt("register", normalizeEmail(body.email));
    const data = await registerUser(body);
    context.status = 201;
    return { data };
  });
}
