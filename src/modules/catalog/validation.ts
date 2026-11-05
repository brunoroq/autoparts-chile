import { ApiError } from "../../lib/http/errors";

export class CatalogError extends ApiError {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_FILTERS",
  ) {
    super(message, status, code);
  }
}
export type CatalogFilters = {
  q: string;
  category: string;
  minPrice?: number;
  maxPrice?: number;
  page: number;
  pageSize: number;
  sort: "name_asc" | "price_asc" | "price_desc";
};

export function parseFilters(params: URLSearchParams): CatalogFilters {
  const allowed = [
    "q",
    "category",
    "minPrice",
    "maxPrice",
    "page",
    "pageSize",
    "sort",
  ];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1)
      throw new CatalogError("Parámetros desconocidos o repetidos.");
  }
  const number = (key: string, fallback?: number, max = 2147483647) => {
    const text = params.get(key);
    if (text === null || text === "") return fallback;
    if (!/^\d+$/.test(text))
      throw new CatalogError(`${key} debe ser un entero no negativo.`);
    const value = Number(text);
    if (!Number.isSafeInteger(value) || value > max)
      throw new CatalogError(`${key} está fuera de rango.`);
    return value;
  };
  const q = (params.get("q") ?? "").trim();
  const category = params.get("category") ?? "";
  const sort = params.get("sort") || "name_asc";
  const page = number("page", 1, 1000000)!;
  const pageSize = number("pageSize", 12, 60)!;
  const minPrice = number("minPrice");
  const maxPrice = number("maxPrice");
  if (
    q.length > 100 ||
    !/^[a-z0-9-]*$/.test(category) ||
    category.length > 160 ||
    page < 1 ||
    pageSize < 1 ||
    !["name_asc", "price_asc", "price_desc"].includes(sort)
  )
    throw new CatalogError("Revisa búsqueda, categoría, orden y paginación.");
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    throw new CatalogError("El precio mínimo no puede superar el máximo.");
  return {
    q,
    category,
    minPrice,
    maxPrice,
    page,
    pageSize,
    sort: sort as CatalogFilters["sort"],
  };
}

export function assertProductId(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new CatalogError(
      "El identificador del producto no es válido.",
      400,
      "INVALID_ID",
    );
}

export function paramsFromRecord(
  record: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  }
  return params;
}
