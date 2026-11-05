import { listCategories } from "@/modules/catalog/service";
import { catalogResponse } from "@/lib/observability/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return catalogResponse("/api/v1/categories", async ({ db }) => {
    if (new URL(request.url).search) {
      const { CatalogError } = await import("@/modules/catalog/validation");
      throw new CatalogError("Categorías no admite parámetros.");
    }
    return { data: await db(() => listCategories()) };
  });
}
