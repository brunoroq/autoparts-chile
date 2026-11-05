import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { instrumentResponse } from "@/lib/observability/request";
import { checkOrigin, readLimitedBody } from "@/lib/http/input";
import { limitAttempt } from "@/lib/auth/rate-limit";
import { ApiError } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const handler = NextAuth(authOptions);
type Context = { params: Promise<{ nextauth: string[] }> };
function run(request: NextRequest, context: Context) {
  return instrumentResponse(
    "/api/auth/[...nextauth]",
    request.method,
    async () => {
      const { nextauth } = await context.params;
      if (request.method === "POST") {
        checkOrigin(request);
        const raw = await readLimitedBody(request.clone());
        if (nextauth.join("/") === "callback/credentials") {
          const form = new URLSearchParams(raw);
          try {
            limitAttempt("login", form.get("email") ?? "");
          } catch (error) {
            if (!(error instanceof ApiError)) throw error;
            return Response.json(
              {
                url: `${new URL(process.env.NEXTAUTH_URL!).origin}/iniciar-sesion?error=RateLimited`,
              },
              {
                status: error.status,
                headers: { "Retry-After": String(error.retryAfter ?? 60) },
              },
            );
          }
        }
      }
      return handler(request, context);
    },
  );
}
export { run as GET, run as POST };
