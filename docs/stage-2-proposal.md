# Propuesta de etapa 2: catálogo

Estado: propuesta aprobada por el usuario en prompt 007 e implementada el 2026-11-04. Base técnica en commit `4d224a6`. El contenido siguiente conserva el diseño propuesto; las decisiones finales y verificaciones están en [verificación de etapa 2](verification-stage-2.md). No incluye carrito, autenticación, checkout, pagos, GA4, k6 ni despliegue.

## Diseño visual

Tienda automotriz moderna, profesional y sencilla. Fondo blanco (#FFFFFF), superficies gris claro (#F3F4F6), texto casi negro (#111111), gris secundario (#525252) y acentos rojo oscuro (#B91C1C). Comprobar contraste en los usos efectivos; no transmitir disponibilidad solo por color.

- Encabezado: marca tipográfica AutoParts Chile, navegación Inicio/Catálogo y buscador. Sin iconos o enlaces de compra no implementados.
- Inicio: hero con fotografía automotriz optimizada y titular «Equipa tu auto para cada camino», llamada a explorar catálogo; seis categorías y seis productos destacados consultados de PostgreSQL. Sin carrusel, video, reseñas ficticias ni promociones inventadas.
- Catálogo: encabezado, total de resultados, filtros y grilla de tarjetas. En escritorio, filtros en columna lateral; en móvil, bloque desplegable accesible. Una, dos o cuatro columnas según ancho disponible. Cada tarjeta contiene imagen, categoría, nombre y precio CLP; su acción es ver detalle.
- Detalle: breadcrumbs, imagen, nombre, categoría, SKU, descripción, precio, disponibilidad informativa y enlace al catálogo. Sin botón de compra inactivo.
- Pie de página simple con marca e identificación del proyecto académico. Tipografía de sistema para evitar descargas y dependencias externas. Espaciado generoso y foco visible; respetar movimiento reducido.

Estados explícitos de carga, catálogo vacío, búsqueda sin coincidencias, error recuperable y producto inexistente. No sustituir un error de base por productos estáticos.

## Páginas y navegación

| Ruta | Contenido |
| --- | --- |
| `/` | Inicio con categorías y productos destacados reales |
| `/catalogo` | Listado paginado, búsqueda, categoría, precio y orden |
| `/productos/[slug]` | Detalle de producto activo; 404 si no existe |

Filtros en URL para compartir enlaces y reproducir pruebas. Cambiar búsqueda/filtro/orden reinicia página a 1; conservar otros filtros y permitir limpiarlos. Búsqueda por envío de formulario, evitando peticiones por cada tecla. Renderizado de servidor; componentes cliente solo para interacciones necesarias.

## Productos iniciales (30)

Nombres y precios propuestos son datos ficticios académicos, no cotizaciones comerciales. Cinco productos por categoría; sin atribuir compatibilidad universal ni certificaciones no comprobadas. Las descripciones aclararán restricciones relevantes, por ejemplo voltaje y revisión de compatibilidad en iluminación.

| Categoría | Producto | Precio CLP |
| --- | --- | ---: |
| Iluminación | Kit de ampolletas LED H7 | 24990 |
| Iluminación | Ampolleta halógena H4 | 6990 |
| Iluminación | Luz LED interior de lectura | 4990 |
| Iluminación | Linterna recargable de inspección | 16990 |
| Iluminación | Luz LED para maletero | 7990 |
| Electrónica | Cargador vehicular USB-C | 12990 |
| Electrónica | Transmisor FM Bluetooth | 14990 |
| Electrónica | Soporte de teléfono para ventilación | 8990 |
| Electrónica | Cámara de retroceso | 29990 |
| Electrónica | Medidor digital de voltaje | 9990 |
| Limpieza | Shampoo automotriz 1 L | 7990 |
| Limpieza | Set de paños de microfibra | 5990 |
| Limpieza | Limpiador de llantas 500 ml | 8990 |
| Limpieza | Cepillo para llantas | 4990 |
| Limpieza | Cera líquida 500 ml | 10990 |
| Herramientas | Juego de dados de 24 piezas | 24990 |
| Herramientas | Llave de ruedas en cruz | 13990 |
| Herramientas | Medidor de presión de neumáticos | 6990 |
| Herramientas | Compresor portátil de 12 V | 34990 |
| Herramientas | Juego de destornilladores | 9990 |
| Seguridad | Triángulo reflectante | 7990 |
| Seguridad | Chaleco reflectante | 4990 |
| Seguridad | Martillo de emergencia | 6990 |
| Seguridad | Cables de arranque | 18990 |
| Seguridad | Botiquín vehicular básico | 12990 |
| Accesorios interiores | Organizador de respaldo | 11990 |
| Accesorios interiores | Set de alfombras de goma | 22990 |
| Accesorios interiores | Parasol plegable | 8990 |
| Accesorios interiores | Cubierta de volante | 9990 |
| Accesorios interiores | Organizador de maletero | 15990 |

Presentación monetaria con `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })`; API devuelve enteros y moneda CLP, sin texto formateado como campo numérico.

## API REST

| Método y ruta | Contrato propuesto |
| --- | --- |
| GET `/api/v1/products` | `q`, `category` (slug), `minPrice`, `maxPrice`, `page`, `pageSize`, `sort` |
| GET `/api/v1/products/[id]` | Detalle por UUID; ID mal formado: 400; ausente/inactivo: 404 |
| GET `/api/v1/categories` | Las seis categorías y su cantidad de productos activos |

Páginas y API compartirán servicios; la página de detalle consultará por slug internamente. No añadir un endpoint duplicado por slug.

Parámetros: `page=1`, `pageSize=12` por defecto, máximo 60; `q` hasta 100 caracteres; límites de precio enteros no negativos y `minPrice <= maxPrice`. Órdenes permitidos `name_asc`, `price_asc`, `price_desc`, siempre con desempate por ID. Rechazar valores inválidos y parámetros repetidos ambiguos; filtros sin coincidencias devuelven lista vacía, no error.

Respuesta de listado: `data` y `meta` con `page`, `pageSize`, `total`, `totalPages`. Detalles con categoría y metadatos de imagen; no devolver relaciones de carrito/pedido ni campos internos innecesarios. Error uniforme con código, mensaje e identificador de solicitud; sin excepciones SQL expuestas.

## Consultas y futura evaluación k6

Consultas Prisma parametrizadas, `select` explícito, filtros de productos activos y paginación offset sencilla. Búsqueda inicial `contains` insensible a mayúsculas sobre nombre/descripción/SKU; documentar que no garantiza equivalencia de tildes. Sin Elasticsearch, Redis ni índices de texto anticipados. Medir primero con índices básicos existentes y registrar límites de offset y búsqueda parcial al crecer el catálogo.

Consultas reales en cada petición evaluada: páginas dinámicas y respuestas de API con política `no-store`; sin caché de datos en línea base. La caché de imágenes se documenta por separado. Conteo/listado tendrán semántica coherente documentada sin añadir aislamiento costoso por defecto.

Registro estructurado mínimo por API: requestId, ruta normalizada, método, estado, duración y error normalizado, sin registrar q completo ni credenciales. Sin tablas de logs ni servicio externo. Contratos estables permiten probar navegación, búsquedas selectivas/no selectivas, filtros combinados, paginación y errores; aún no se escriben scripts k6.

## Imágenes

Archivos locales versionados bajo `public/images/products` y `public/images/hero`, con registro de fuente, autor/licencia y cambios en `docs/images.md`. Seleccionar recursos reutilizables con licencia verificada antes de incorporarlos; no descargar imágenes arbitrarias de comercios ni usar marcas como si fueran propias. Si falta una fotografía autorizada, usar ilustración local representativa identificada como tal, sin depender de generación pagada.

Una imagen por producto inicial, más hero. WebP de aproximadamente 800x800 para producto y 1600x900 para hero; presupuestos orientativos <=100 KB y <=200 KB respectivamente, sujetos a calidad visual. `next/image`, dimensiones o contenedor con proporción estable, `sizes` adaptativo y lazy loading; precarga solo de imagen principal visible. Alt descriptivo y fallback local. No usar CDN externo ni cargar originales de varios megabytes.

Ampliación sintética reutiliza las 30 imágenes, sin generar miles de archivos. Añadir `imagePath` e `imageAlt` a Product con valores iniciales compatibles mediante migración nueva; no reescribir migraciones anteriores. Probar optimización de imágenes en build de producción y distinguir caché fría/caliente.

## Seed reproducible

Comando previsto `npm run db:seed -- --size 30` (también 1000 y 10000). Versión de dataset y semilla fija, IDs/SKU/slug deterministas, categorías constantes y precios/stock reproducibles. Los primeros 30 productos son los de la tabla; los adicionales son variantes sintéticas identificables, con distribución equilibrada y términos repetidos para búsquedas de distinta selectividad.

`upsert` para repetir el mismo tamaño sin duplicar. Inserciones/actualizaciones por lotes; no cargar todo mediante miles de promesas concurrentes. Ejecutar explícitamente, nunca en build ni al iniciar servidor.

Conteo exacto esperado sobre base de evaluación vacía o compatible. Si hay más productos de un seed anterior al reducir tamaño, o datos ajenos incompatibles, abortar y explicar cómo preparar una base aislada; no truncar tablas ni borrar pedidos para ajustar el conteo. Cualquier reset requerirá autorización independiente. Mantener estado final de desarrollo en 30 productos; ensayos 1.000/10.000 en base de prueba aislada cuando se autoricen.

## Archivos previstos

- Modificar `src/app/page.tsx`, `layout.tsx` y `globals.css` para inicio e identidad visual.
- Crear `src/app/catalogo/page.tsx`, `src/app/productos/[slug]/page.tsx`, estados `loading.tsx`, `error.tsx` y `not-found.tsx` donde correspondan.
- Crear componentes concretos bajo `src/components/catalog/` y `src/components/layout/`: cabecera, pie, tarjetas, filtros y paginación; sin biblioteca UI adicional.
- Crear `src/modules/catalog/service.ts`, `queries.ts`, `validation.ts` y `types.ts` solo para responsabilidades necesarias; no duplicar repositorios y servicios vacíos.
- Crear tres Route Handlers bajo `src/app/api/v1/` y helper mínimo `src/lib/observability/request.ts`.
- Modificar `prisma/schema.prisma`; crear migración de imagen y `prisma/seed.ts`; datos deterministas en `prisma/seed-data.ts`.
- Incorporar imágenes locales y procedencia; adaptar `next.config.ts` solo si la optimización lo requiere, sin lista de hosts remotos por defecto.
- Actualizar scripts en `package.json`, configuración seed de `prisma.config.ts`, pruebas bajo `tests/`, script smoke y lockfile únicamente si cambian dependencias aprobadas. No se prevén nuevas dependencias de producción.
- Actualizar README, AGENTS, LogFile, arquitectura, base de datos, decisiones y contratos `docs/api/catalog.md`; documentar resultados en `docs/verification-stage-2.md`.

## Pruebas propuestas

1. Validación de filtros, precios y paginación; CLP y desempate estable, con runner nativo de Node y tsx existente.
2. Seed: exactamente seis categorías y 30 productos; repetir sin duplicados; determinismo y cardinalidad del generador de 1.000/10.000 sin poblar la base habitual; rechazo de tamaños inválidos y reducciones destructivas.
3. Integración PostgreSQL: listado, búsqueda, categoría, rango/combinación de precios, paginación, detalle activo, inactivo e inexistente; base aislada para casos que escriban datos.
4. API HTTP: 200/400/404/500 controlados, formato de respuesta, moneda, límites y `no-store`. No modificar la base habitual para simular fallos; usar entorno aislado.
5. Navegador: escritorio/móvil, filtros y URL, navegación, teclado/foco, estados vacíos/error/404 y ausencia de enlaces sin función. Verificar imágenes, proporciones y lazy loading.
6. Prisma validate/generate, migración, lint, tipos, build de producción y smoke de inicio/catálogo/detalle/API. Registrar evidencia y errores; no presentar esta validación como benchmark.

## Evaluación de ESLint

ESLint 10.14.0 soporta Node 24 y Next 16.4.5 declara peer >=9. Sin embargo, los plugins actualmente resueltos `eslint-plugin-react@7.37.5`, `eslint-plugin-import@2.32.0` y `eslint-plugin-jsx-a11y@6.10.2` declaran compatibilidad hasta ESLint 9. Simulación de instalación emite `ERESOLVE overriding peer dependency`.

Recomendación: no actualizar todavía. Mantener deuda documentada y reevaluar cuando toda la cadena declare soporte, o proponer por separado una sustitución de configuración con su costo y pruebas. No instalar con force, legacy-peer-deps ni overrides para silenciar incompatibilidades. No suponer que subir ESLint resuelve el aviso minimatch de typescript-eslint.

Fuentes consultadas: [soporte ESLint](https://eslint.org/version-support/), [migración v10](https://eslint.org/docs/latest/use/migrate-to-10.0.0), [guía Next 16](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/upgrading/version-16.mdx), metadatos npm y peerDependencies efectivas del lockfile local. La guía general de Next no reemplaza la comprobación de cada plugin instalado.
