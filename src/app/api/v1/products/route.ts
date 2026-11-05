import { listProducts } from "@/modules/catalog/service";
import { parseFilters } from "@/modules/catalog/validation";
import { catalogResponse } from "@/lib/observability/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return catalogResponse("/api/v1/products", async ({ db }) => {
    const filters = parseFilters(new URL(request.url).searchParams);
    return db(() => listProducts(filters));
  });
}
