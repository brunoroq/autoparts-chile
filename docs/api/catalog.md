# API de catálogo v1

Tres endpoints GET públicos de solo lectura. Runtime Node.js, Route Handlers dinámicos, datos PostgreSQL mediante Prisma; sin caché de datos. Todas las respuestas del handler llevan `Cache-Control: no-store`, `X-Request-Id` y `Server-Timing`.

## GET /api/v1/products

| Parámetro | Regla |
| --- | --- |
| q | Opcional, hasta 100 caracteres tras trim; nombre/descripción/SKU, insensible a mayúsculas |
| category | Slug de categoría; una categoría desconocida da lista vacía |
| minPrice / maxPrice | Enteros CLP entre 0 y 2147483647; mínimo <= máximo |
| page | Entero 1..1000000, por defecto 1 |
| pageSize | Entero 1..60, por defecto 12 |
| sort | name_asc (predeterminado), price_asc, price_desc |

Parámetros desconocidos o repetidos: 400. Valores numéricos vacíos equivalen a omitirlos, para permitir formularios HTML. Sin coincidencias o página fuera de resultados: 200 con data vacía. totalPages es 0 para cero resultados.

Ejemplo: `/api/v1/products?q=LED&category=iluminacion&minPrice=0&maxPrice=30000&sort=price_desc&page=1&pageSize=12`.

Respuesta: `{ data: Product[], meta: { page, pageSize, total, totalPages } }`. Cada producto expone id, sku, slug, name, description, priceClp, currency (CLP), stock, imagePath, imageAlt y categoría (id/name/slug). Solo productos activos.

## GET /api/v1/products/[id]

UUID con formato inválido: 400 INVALID_ID. Ausente o inactivo: 404 NOT_FOUND. Éxito: `{ data: Product }`. Las páginas consultan el mismo servicio por slug internamente; no realizan HTTP contra la API propia.

## GET /api/v1/categories

Sin parámetros; responde `{ data: [{ id, name, slug, productCount }] }`. productCount incluye solo productos activos. Parámetros no vacíos: 400.

## Errores

Formato: `{ error: { code, message, requestId } }`. Códigos: INVALID_FILTERS, INVALID_ID, NOT_FOUND e INTERNAL_ERROR (500). No se exponen mensajes de Prisma, SQL, conexión ni credenciales.

## Instrumentación y consistencia

Logs JSON en stdout: event, timestamp UTC, requestId, route normalizada, method, status, totalMs, dbMs y error normalizado si corresponde. No se registra la búsqueda completa ni se escriben logs en PostgreSQL.

`totalMs` mide el handler de aplicación, validación, operación y serialización JSON hasta preparar la respuesta. No incluye transmisión de red ni toda la infraestructura de Next.js; la latencia extremo a extremo se medirá desde el cliente en etapas posteriores. `dbMs` mide tiempo de pared alrededor de la operación Prisma: incluye pool, driver y transacción; no equivale al tiempo SQL interno del servidor. `Server-Timing` entrega app y db en milisegundos. Errores anteriores a consultar DB tienen dbMs=0.

Listado y conteo comparten snapshot en una transacción RepeatableRead para evitar discrepancias durante escrituras concurrentes. El orden siempre desempata por UUID. La navegación entre solicitudes puede variar si cambia el catálogo; no se promete snapshot entre páginas HTTP independientes. Registrar este aislamiento al analizar desempeño.

Sin índices de texto o caché adicionales: búsqueda parcial y offset son una línea base sencilla con costos medibles al crecer los datos. La búsqueda no normaliza tildes. No hay generador k6 implementado en esta etapa.
