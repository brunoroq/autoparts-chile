# Verificación de etapa 2

Actualización de cierre: prompt 010 autoriza versionar conjuntamente etapas 2 y 3 tras nueva auditoría y regresión. Este informe conserva los resultados y estado anteriores al commit; el cierre actual se consulta en Git y en la entrada 010 de LogFile.txt.

Fecha: 4 de noviembre de 2026 (America/Santiago). Aprobación: prompt 007 de LogFile.txt. Base: commit `4d224a6`. Cambios de etapa 2 sin commit, sin despliegue y sin avance a etapa 3.

## Funcionalidades entregadas

Inicio con hero automotriz, seis categorías y seis productos seleccionados mediante orden de nombre determinista desde PostgreSQL. Catálogo con búsqueda por nombre/descripción/SKU, filtros de categoría y precio CLP, orden y paginación estable. Detalle por slug, estados de carga/error/404/vacío, precios y existencias ficticios explícitos. Identidad blanca, negra, gris y roja. Filtros plegados en móvil tras hidratación; sin JavaScript quedan accesibles abiertos.

API GET de productos, categorías y detalle por UUID; servicios compartidos con las páginas. Sin HTTP interno, caché de datos, logs en base ni dependencias nuevas de producción. Instrumentación JSON y Server-Timing con requestId, estado y tiempos. Semillas deterministas 30/1000/10000, migración de imágenes y recursos locales optimizados con procedencia documentada.

## Resultados reales

| Verificación | Resultado |
| --- | --- |
| Docker/PostgreSQL | Contenedor healthy; PostgreSQL 17.11 en localhost:5432 |
| Migración | `20261104235500_catalog_images` aplicada; migraciones anteriores conservadas |
| Seed habitual | Dos ejecuciones size 30: seis categorías y 30 productos en ambas |
| Base aislada | `autoparts_catalog_test` creada y migrada, sin borrar datos |
| Integración | 1 test compuesto exitoso: semillas 30/1000/10000, idempotencia, búsquedas, filtros combinados, órdenes, paginación sin solapamiento, inactivo/inexistente, protección contra reducción |
| Seed aislado adicional | `db:seed:test -- --size 10000` repitió dataset sin duplicar; base habitual siguió en 30 |
| Unitarias | 5/5: validación, construcción de consultas, determinismo/cardinalidad, CLP y error 500 seguro |
| HTTP | 3/3: 200, 400 y 404, búsqueda/filtros/orden/páginas, moneda y headers |
| HTTP 500 aislado | 1/1 contra localhost:3001 con DB inaccesible; sin filtrar URL ni credenciales |
| Smoke | Inicio, catálogo, detalle, API y optimizador Next Image respondieron HTTP 200 |
| Navegador | 6/6 en Chrome: tres recorridos en 1440x1000 y 390x844 |
| Teclado | Enlace de salto, foco visible, Tab y Enter, abrir/cerrar filtros; paginación y estados vacíos/404 |
| Responsive | Sin desbordamiento horizontal en vistas verificadas; capturas de inicio, catálogo y detalle revisadas visualmente |
| Imágenes | Hero precargado, productos lazy; imágenes cargadas al recorrerlas, tamaños y srcset; hero 191.920 bytes y productos <=7.934 bytes |
| Código | `npm run validate`: lint sin advertencias, tipos y Prisma correctos |
| Producción | `npm run build` exitoso; inicio, catálogo, detalle y API figuran dinámicos |
| Auditoría | `npm audit --omit=dev`: cero vulnerabilidades; ocho avisos moderados de tooling conocidos tras instalar Playwright |
| Dependencias | ESLint 9.39.5 mantenido; única adición directa: @playwright/test 1.64.1 en dev; sin force |

Son verificaciones funcionales, no benchmarks ni pruebas de carga. Las duraciones de ejecución de pruebas no se presentan como capacidad del sistema.

## Comandos de revisión

Con `.env` local existente, Docker activo y desde la raíz del proyecto:

```powershell
npm ci
npm run db:up
npm run db:generate
npm run db:deploy
npm run db:seed -- --size 30
npm run validate
npm test
npm run test:prepare
npm run test:integration
npm run build
npm start
```

No reconstruir `.next` mientras `npm start` esté activo. Detener el servidor con Ctrl+C antes del build y reiniciarlo después. Para desarrollo interactivo usar `npm run dev` en lugar de `npm start`.

En otra terminal, con el servidor de producción activo:

```powershell
npm run test:http
npm run check:http
npm run test:browser
```

Para reproducir exclusivamente el error controlado, abrir otra terminal con una conexión ficticia a un puerto local sin servidor PostgreSQL (sin credenciales reales):

```powershell
$env:DATABASE_URL = 'postgresql://autoparts:unused@127.0.0.1:65432/autoparts_catalog_test'
npm start -- --port 3001
```

Desde otra terminal ejecutar `npm run test:http:error`. Cerrar el servidor 3001 al terminar y cerrar esa terminal para descartar la variable; no detener la base habitual ni cambiar `.env` para esta prueba. El servidor aislado usado durante esta implementación fue detenido.

## Archivos creados

- Páginas: `src/app/catalogo/page.tsx`, `src/app/productos/[slug]/page.tsx`, `src/app/loading.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`.
- API: `src/app/api/v1/products/route.ts`, `src/app/api/v1/products/[id]/route.ts`, `src/app/api/v1/categories/route.ts`.
- Componentes: `src/components/layout/site-header.tsx`, `site-footer.tsx`; `src/components/catalog/category-icon.tsx`, `product-image.tsx`, `product-card.tsx`, `catalog-filters.tsx`, `pagination.tsx`.
- Lógica: `src/modules/catalog/validation.ts`, `queries.ts`, `service.ts`; `src/lib/format.ts`, `src/lib/observability/request.ts`.
- Datos: `prisma/seed-data.ts`, `prisma/seed.ts`, `prisma/migrations/20261104235500_catalog_images/migration.sql`.
- Recursos: `public/images/hero/road.webp`, 30 WebP de producto, fallback y 30 SVG fuente.
- Utilidades: `scripts/create-product-images.mjs`, `prepare-test-db.ts`, `seed-test-db.ts`.
- Pruebas: `playwright.config.ts`, `tests/catalog.test.ts`, `catalog.integration.test.ts`, `catalog.http.test.ts`, `catalog.error-http.test.ts`, `database.ts`, `tests/browser/catalog.spec.ts`.
- Documentación: `docs/api/catalog.md`, `docs/images.md`, este informe. `docs/stage-2-proposal.md` ya existía sin commit antes de esta implementación y se actualizó su estado.

## Archivos modificados

`src/app/page.tsx`, `layout.tsx`, `globals.css`; `prisma/schema.prisma`, `prisma.config.ts`; `package.json`, `package-lock.json`; `.gitignore`, `.env.example` (ejemplo de conexión aislada comentado); `scripts/check-http.mjs`; AGENTS, LogFile, README, arquitectura, plan, decisiones y base de datos. `scripts/check-db.ts` y `src/lib/db/prisma.ts` recibieron solo formato para legibilidad. Los tipos de dominio se derivan de Prisma/servicios; no se agregó un archivo de tipos redundante.

## Problemas encontrados y correcciones

1. Primer parche compuesto rechazado por intentar borrar/crear el mismo archivo; no se aplicó parcialmente. Se dividió en actualizaciones independientes.
2. Lint interpretó los dos slash del logotipo como comentario JSX; se corrigió a una expresión de texto.
3. tsx falló en sandbox con `uv_os_get_passwd ENOMEM`; las mismas pruebas autorizadas fuera del sandbox pasaron. No fue un fallo de PostgreSQL.
4. CUA informó host de navegador y pipe nativo indisponibles. Se sustituyó esa revisión por Playwright como dependencia de desarrollo, usando Chrome ya instalado. No se afirmó una revisión manual que no ocurrió: se revisaron capturas de pruebas automatizadas.
5. Las primeras pruebas/capturas podían observar estados de streaming; ahora esperan contenido visible y estabilidad de red para teclado, y recorren imágenes lazy antes de capturar. No se desactivó lazy loading para hacerlas pasar.
6. Se reconstruyó inicialmente mientras un servidor anterior seguía activo: aparecieron estilos mezclados, desbordamiento y clics interceptados. Se detuvo ese servidor, compiló y reinició; suite final 6/6. Se documenta el orden correcto.
7. Stop-Process falló al cerrar el servidor anterior; se cerró su sesión de ejecución y se inició correctamente el nuevo build. No se terminaron procesos ajenos.
8. Hero inicial de 606 KB reducido a 191.920 bytes; la escritura del archivo descargado requirió escalación autorizada. Las ilustraciones generaron avisos de caché fontconfig no escribible, sin impedir la creación ni su verificación visual.
9. Playwright informó NO_COLOR/FORCE_COLOR incompatibles en el entorno; advertencia sin efecto en resultados. ESLint 10 sigue incompatible con los peers de varios plugins instalados; mantener 9 fue instrucción explícita del usuario.

## Límites y estado final

No hay compras, autenticación, carrito, pagos, GA4, generadores de carga, despliegue ni etapa 3. No se modificó la política global de npm, Git, Docker ni Windows. `.env`, node_modules, cliente Prisma generado, `.next`, capturas y datos PostgreSQL siguen fuera de Git.

La base habitual tiene 30 productos y la base aislada 10.000, sin borrados automáticos. PostgreSQL y el servidor de producción en localhost:3000 se dejaron activos para revisión. Alcance responsive comprobado en Chrome y las dos resoluciones indicadas; no se afirma compatibilidad exhaustiva con todos los navegadores/dispositivos.
