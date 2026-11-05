import { findProduct } from "@/modules/catalog/service";
import { assertProductId, CatalogError } from "@/modules/catalog/validation";
import { catalogResponse } from "@/lib/observability/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return catalogResponse("/api/v1/products/[id]", async ({ db }) => {
    const { id } = await context.params;
    assertProductId(id);
    const product = await db(() => findProduct(id));
    if (!product)
      throw new CatalogError("Producto no encontrado.", 404, "NOT_FOUND");
    return { data: product };
  });
}
