# Correcciones locales de instrumentación GA4

Fecha: 2026-11-06. Analytics continúa desactivado; esta tarea no cambia variables locales o Vercel ni publica código. No se contactó Google, producción o Neon.

## Semántica de los eventos

- `page_view`: una vista por transición observada de ruta/parámetros, incluida navegación atrás, regreso y recarga del documento. Los renders y cambios de estado no generan otra vista. Se eliminó la supresión por ruta en sessionStorage. Los parámetros solo se comparan en memoria: no se envían consultas, términos de búsqueda ni tokens. Un componente dentro de Suspense observa useSearchParams sin forzar la hidratación del contenido de la tienda.
- `view_item` y `begin_checkout`: cada montaje tiene una identidad de observación; si cambia el producto/contenido identificado, obtiene otra. Se conserva durante renders y replay de efectos de StrictMode. Volver o recargar permite emitir otra interacción legítima. Se mantiene la deduplicación por clave para cada observación.
- `remove_from_cart`: se emite después de eliminar correctamente una línea completa, para invitados y autenticados. Incluye item_id, cantidad retirada, precio unitario, total y moneda CLP. El snapshot de precios proviene de la última respuesta/cotización validada del servidor, nunca de localStorage. Si el catálogo cambia entre lecturas, representa ese snapshot, no una nueva cotización del producto eliminado. Fallos y modificaciones de cantidad no emiten este evento.
- `debug_mode`: solo existe cuando GA4_DEBUG=true; false lo omite del config y los eventos.
- `purchase`: persistencia, endpoint, reclamación condicional, transaction_id e implementación de PurchaseEvent sin cambios. Se conserva su límite conocido: reclamar no acredita recepción por Google y no hay reintentos automáticos.

Consentimiento obligatorio antes de cargar gtag o enviar eventos. Rutas normalizadas, importes CLP saneados y sin datos personales. Las claves antiguas ap-page de sessionStorage dejan de determinar vistas. No se modificaron autenticación, checkout comercial, pagos, inventario, Prisma, migraciones ni esquema.

## Verificaciones locales

Comandos:

```powershell
npm test
npm run test:analytics:browser:local
npm run validate
npm run build
```

Resultados: 29 unitarias y cuatro pruebas de navegador correctas, lint, TypeScript, Prisma y build correctos. El navegador ejecuta componentes React reales en StrictMode mediante un harness HTTP local; sustituye Next Script/Navigation/Link/Image y respuestas HTTP, e intercepta Google. Usa esbuild disponible a través de tsx, sin agregar dependencias. No crea usuarios, carritos, pedidos o pagos en una aplicación/base real. La prueba de purchase usa únicamente una respuesta ficticia de reclamación en memoria, no ejecuta checkout ni pagos.

Cobertura: consentimiento desconocido/rechazado/aceptado/revocado; recargas y regresos, atrás y cambios de filtros; rerenders sin duplicados; cambio entre productos conservando el componente; nuevo begin_checkout al regresar; depuración true/false y privacidad; eliminación correcta autenticada/invitada, error HTTP sin evento y eliminación sin consentimiento; purchase sin duplicación al renderizar, regresar o recargar con reclamación simulada.

También se actualizó la expectativa obsoleta del spec integrado existente: recargar un producto ahora emite un view_item. No se ejecutó ese spec porque crea cuentas y pedidos de prueba; la autorización actual lo excluye. No se modificó la lógica de persistencia de purchase, verificado en el diff.

## Pendiente antes y después de publicar

Todos los eventos siguen pendientes de comprobar con esta versión en Vercel y recepción real en GA4 DebugView/Realtime. El harness valida instrumentación y efectos React, no sustituye una prueba sobre el router real de Next.js ni confirma recepción por Google. La restauración de documentos completos desde BFCache tampoco quedó cubierta por esta batería.

Para activar en otra tarea autorizada: configurar el ID correcto y opt-in; durante diagnóstico GA4_DEBUG=true y después false. Desactivar las vistas por historial de la medición mejorada de GA4 para evitar duplicarlas con las manuales. No instalar una segunda etiqueta. Revisar privacidad de las demás opciones automáticas antes de habilitarlas.

Puede validarse page_view/view_item/add_to_cart/remove_from_cart con un visitante y carrito local sin stock reservado. begin_checkout exige una sesión y un carrito autenticado; purchase exige otra autorización y un pedido pagado elegible: abrir uno antiguo podría reclamarlo por primera vez y modificar su marca analítica. No fabricar compras para completar la evidencia ni restablecer reclamaciones. No hay backfill ni nueva compra autorizados por estas correcciones.

Sin commits, push, despliegues, pruebas de carga, nuevas cuentas o compras. Los cambios anteriores pendientes en el repositorio se conservaron.


Verificación del contenido exclusivo preparado para publicación: 27 unitarias (sin las dos del verificador E2E pendiente), cuatro pruebas locales de navegador, lint, TypeScript, Prisma y build correctos. El build se repitió en copia hermana aislada para evitar la advertencia de raíz de una copia anidada; no se modificó next.config. GA4 continúa opt-in y la lectura pública previa devuelve enabled=false, ID vacío y ningún script Google. La comprobación de recepción real en GA4 permanece pendiente.
