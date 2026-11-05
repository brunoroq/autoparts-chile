export const runtime = "nodejs";
import { checkOrigin, readJson } from "@/lib/http/input";
import { ApiError } from "@/lib/http/errors";
import { apiResponse } from "@/lib/observability/request";
import { analyticsConfig, experimentContext } from "@/lib/observability/config";
import { vitalsInput } from "@/lib/observability/vitals";
import { AttemptLimiter } from "@/lib/auth/rate-limit";
const limiter = new AttemptLimiter(1);
export function POST(request: Request) {
  return apiResponse("/api/v1/telemetry/web-vitals", "POST", async () => {
    checkOrigin(request);
    if (!analyticsConfig().vitals)
      throw new ApiError("Telemetría desactivada.", 404, "TELEMETRY_DISABLED");
    limiter.take("vitals", 300, 60000);
    const metrics = vitalsInput(await readJson(request));
    for (const metric of metrics)
      console.log(
        JSON.stringify({
          event: "web_vital",
          timestamp: new Date().toISOString(),
          ...experimentContext(),
          ...metric,
          source: "browser_untrusted",
        }),
      );
    return { accepted: metrics.length };
  });
}
