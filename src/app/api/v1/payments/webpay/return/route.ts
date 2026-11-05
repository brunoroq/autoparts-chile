export const runtime = "nodejs";
import { instrumentResponse } from "@/lib/observability/request";
import { webpayReturn, webpayReturnMetadata } from "@/modules/orders/service";
import { ApiError } from "@/lib/http/errors";
import { readLimitedBody } from "@/lib/http/input";
async function handle(request: Request) {
  return instrumentResponse(
    "/api/v1/payments/webpay/return",
    request.method,
    async () => {
      const params =
        request.method === "GET"
          ? new URL(request.url).searchParams
          : new URLSearchParams(await readLimitedBody(request));
      const tokens = params.getAll("token_ws"),
        cancelled = params.getAll("TBK_TOKEN");
      if (tokens.length + cancelled.length > 1)
        throw new ApiError(
          "Retorno inválido. Revisa tu pedido y verifica el estado desde tu cuenta.",
        );
      const order =
        tokens.length + cancelled.length === 1
          ? await webpayReturn(tokens[0] || cancelled[0], !!tokens.length)
          : await webpayReturnMetadata(
              params.get("TBK_ORDEN_COMPRA") || "",
              params.get("TBK_ID_SESION") || "",
            );
      return Response.redirect(
        new URL("/pedidos/" + order.id, process.env.NEXTAUTH_URL),
        303,
      );
    },
  );
}
export const GET = handle;
export const POST = handle;
