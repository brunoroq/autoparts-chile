import { createHash } from "node:crypto";

export const DATASET_VERSION = "autoparts-v1";
export const categoryData = [
  ["Iluminación", "iluminacion"],
  ["Electrónica", "electronica"],
  ["Limpieza", "limpieza"],
  ["Herramientas", "herramientas"],
  ["Seguridad", "seguridad"],
  ["Accesorios interiores", "accesorios-interiores"],
] as const;

export const productData: ReadonlyArray<readonly [string, number]> = [
  ["Kit de ampolletas LED H7", 24990],
  ["Ampolleta halógena H4", 6990],
  ["Luz LED interior de lectura", 4990],
  ["Linterna recargable de inspección", 16990],
  ["Luz LED para maletero", 7990],
  ["Cargador vehicular USB-C", 12990],
  ["Transmisor FM Bluetooth", 14990],
  ["Soporte de teléfono para ventilación", 8990],
  ["Cámara de retroceso", 29990],
  ["Medidor digital de voltaje", 9990],
  ["Shampoo automotriz 1 L", 7990],
  ["Set de paños de microfibra", 5990],
  ["Limpiador de llantas 500 ml", 8990],
  ["Cepillo para llantas", 4990],
  ["Cera líquida 500 ml", 10990],
  ["Juego de dados de 24 piezas", 24990],
  ["Llave de ruedas en cruz", 13990],
  ["Medidor de presión de neumáticos", 6990],
  ["Compresor portátil de 12 V", 34990],
  ["Juego de destornilladores", 9990],
  ["Triángulo reflectante", 7990],
  ["Chaleco reflectante", 4990],
  ["Martillo de emergencia", 6990],
  ["Cables de arranque", 18990],
  ["Botiquín vehicular básico", 12990],
  ["Organizador de respaldo", 11990],
  ["Set de alfombras de goma", 22990],
  ["Parasol plegable", 8990],
  ["Cubierta de volante", 9990],
  ["Organizador de maletero", 15990],
];

export function stableId(key: string) {
  const hex = createHash("sha256")
    .update(`${DATASET_VERSION}:${key}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseSeedSize(value: string | undefined) {
  if (!value || !["30", "1000", "10000"].includes(value))
    throw new Error("Usa --size 30, 1000 o 10000.");
  return Number(value);
}

export function buildCatalog(size: number) {
  parseSeedSize(String(size));
  const categories = categoryData.map(([name, slug]) => ({
    id: stableId(`category:${slug}`),
    name,
    slug,
  }));
  const products = Array.from({ length: size }, (_, i) => {
    const index = i % 30;
    const [baseName, basePrice] = productData[index];
    const synthetic = i >= 30;
    const name = synthetic
      ? `${baseName} · Variante de prueba ${String(i + 1).padStart(5, "0")}`
      : baseName;
    return {
      id: stableId(`product:${i + 1}`),
      sku: `AP-SEED-${String(i + 1).padStart(5, "0")}`,
      slug: slugify(name),
      name,
      categoryId: categories[Math.floor(index / 5)].id,
      description: `${baseName}: un complemento práctico para equipar y cuidar tu vehículo. ${synthetic ? "Variante sintética para evaluación de rendimiento. " : ""}Producto de demostración académica, con precio y stock ficticios. Revisa medidas, voltaje y compatibilidad con tu vehículo antes de elegir. La ilustración es referencial; no representa una marca ni una certificación.`,
      priceClp: synthetic ? basePrice + (i % 11) * 1000 : basePrice,
      stock: 5 + ((i * 17) % 46),
      active: true,
      imagePath: `/images/products/product-${String(index + 1).padStart(2, "0")}.webp`,
      imageAlt: `Ilustración referencial: ${baseName.toLowerCase()}`,
    };
  });
  return { categories, products };
}
