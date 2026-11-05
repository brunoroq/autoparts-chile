# Verificación de etapa 5

Fecha: 5 de noviembre de 2026, America/Santiago. Base: commit b4fd0006c5db5ac66d220955b64f08a746b6f60d. No se realizó commit de etapa 5. Stack conservado: Next 16.4.5, React 19.3.1, TypeScript 5.9.3, Prisma 7.10.1, ESLint 9.39.5 y Node 24.21.0. Sin dependencias nuevas.

## Implementado

- gtag.js con next/script, ID válido, activación explícita y consentimiento antes de cargar. Rechazo, persistencia de preferencia y retirada sin cerrar sesión.
- Cuatro eventos CLP con valores del servidor, lista permitida de campos y rutas/títulos normalizados. Deduplicación por sesión de pestaña y marca de purchase persistente; transaction_id estable. La reclamación no acredita recepción por Google y no hay reintentos complejos.
- Web Vitals de Next reales: LCP e INP ms, CLS sin unidad; documentos/IDs/secuencias, dispositivo, entorno y experimento. Receptor propio validado, limitado y desactivable.
- Etiquetas comunes del servidor, clasificación de errores, resultados comerciales de pago separados, CPU/memoria/event loop y conexiones PostgreSQL opcionales. Observador Docker fuera del proceso de aplicación, contadores numéricos en bytes.
- Manifiesto de experimento sin secretos y exportaciones CSV/JSON para solicitudes, percentiles, throughput, recursos y Web Vitals consolidados. Sin escenarios k6 ni despliegue.

## Evidencia ejecutada durante implementación

Unitarias de lista permitida/importes, configuración opt-in/separación de IDs, unidades/validación/consolidación, percentiles/throughput/clasificación/CSV y regresiones existentes exitosas. Integración real de reclamación concurrente: solo una gana; usuario ajeno 404, pedido pendiente 409 y conexión nueva no vuelve a reclamar. Las pruebas de checkout, usuarios/carrito, catálogo/seed y contratos HTTP existentes también se ejecutaron correctamente en sus bases aisladas.

Primera suite completa de navegador: 16/16 exitosas (37,9 s), ocho recorridos en escritorio y móvil. Incluye consentimiento, ausencia de Google antes de aceptar o tras rechazo, los cuatro eventos, importes 12.345/24.690 CLP de un producto de prueba del servidor, recargas sin duplicación, transaction_id estable, reclamación repetida null y exclusión de correo/contraseña/parámetros sensibles del transporte interceptado. Se añade caso de script bloqueado para la ronda final.

La captura del servidor de prueba contiene Web Vitals reales de Chrome mediante el hook de Next: LCP, CLS e INP, además de lotes manuales de validación. Se exportaron 215 registros de una captura parcial y 48 IDs de métricas consolidados; no interpretar estos datos heterogéneos de pruebas como benchmark o muestra de usuarios reales. Archivos locales ignorados: `tmp/analytics-browser-export/` y captura `tmp/analytics-browser-capture.jsonl`.

`npm run test:observability` inició otro proceso aislado, produjo solicitudes 200/400/401 y dos actualizaciones CLS controladas, verificó CPU/RSS/heap/event loop, conexión observadora PostgreSQL y Docker real, y generó seis archivos de exportación. Primera comprobación: 11 registros, una métrica CLS consolidada con valor 0,2, sin resource_error. Artefactos ignorados en `tmp/observability-EfYQ5h/export/`. Se verificó ausencia de secretos locales conocidos en los logs capturados. Estos pocos requests validan instrumentos; no son una prueba de carga.

Lint, TypeScript, Prisma y build pasaron durante implementación. La ronda final con el código de cierre se registra al terminar.

## Reproducción

```powershell
npm run test:analytics:prepare
npm test
npm run test:analytics:integration
npm run test:observability
npm run validate
# Detener todos los servidores antes de reconstruir:
npm run build
# Terminales separadas:
npm start
npm run test:auth:server
npm run test:checkout:server
npm run test:analytics:server
# Terminal de pruebas:
npm run test:browser
npm run test:auth:http
npm run test:checkout:http
npm run test:http
npm run check:http
```

`autoparts_analytics_test` es local y termina en _test; fixtures propios y usuarios aleatorios por ejecución. Preparación no borra datos ni reduce catálogos con fixtures adicionales. Servidor 3005 usa ID ficticio y los tests interceptan Google; la tienda habitual conserva analítica desactivada. El receptor de Web Vitals confía solo en metadatos del servidor para experimento/tráfico y no habilita autorización comercial.

## Problemas encontrados y corregidos

- El formateador movió una excepción de lint necesaria para la cola Arguments oficial de gtag. Se ubicó sobre la instrucción exacta; sin desactivar reglas globales.
- Un patrón de formateo no reconoció `[id]`; se formateó el directorio padre. Sin cambios de dependencias.
- Preparar nuevamente una base con productos de fixtures disparó la protección del seed contra reducción del catálogo. Se conserva el catálogo mayor y se aplican las migraciones sin borrados; se comprobó una base de checkout con 107 productos conservados.
- En PowerShell antiguo se necesita UTF-8 explícito al capturar stdout; el exportador admite BOM UTF-8, rechaza capturas sin métricas y evita sobrescribir reportes.

## Límites y comprobaciones manuales pendientes

No se creó propiedad GA4, no se envió a una propiedad real ni se verificó DebugView externo: faltan los IDs del propietario y su configuración. No se otorgó acceso al profesor. [Procedimiento completo](stage-5.md). La prueba manual del sandbox oficial Webpay continúa pendiente, sin cambios de esa limitación.

Los envíos de navegador pueden perderse por bloqueo, retirada de consentimiento, cierre o red; no se garantiza recepción. El registro de compra de PostgreSQL prevalece. GA4 no es fuente de throughput, CPU ni errores técnicos. El sobrecosto de instrumentación aún no se cuantificó bajo carga y las métricas de infraestructura cloud dependen de permisos/disponibilidad. No se inició etapa 6.

## Archivos afectados

Nuevos módulos analytics y observability (config/resources/vitals/docker), provider/eventos y WebVitals cliente, instrumentation, endpoint de reclamación y receptor, migración nullable, scripts de exportación/observación/manifiesto/comprobación y pruebas unitarias/Prisma/Chrome con base aislada. Modificados layout, detalle, checkout, carrito y sus contratos, detalle de pedido, helper de instrumentación, estilos mínimos de consentimiento, scripts de preparación, schema, scripts npm, ejemplo de entorno e instrucciones/documentación. Sin .env privado, credenciales, datos locales, dependencias instaladas o salidas generadas versionadas.

## Cierre final

2026-11-05T14:05:35-03:00: cierre funcional de etapa 5. 18 unitarias, 13 casos de integración PostgreSQL (10 checkout, 1 analítica, 1 usuarios/carrito, 1 catálogo/seed), 8 HTTP y 18 navegador (37,5 s en última suite): 57 pruebas exitosas. validate (lint/TypeScript/Prisma) y build exitosos; reinicio real de checkout y observabilidad real/exportaciones correctos. Captura final de observabilidad: 11 registros, un CLS consolidado de 0,2, Node/PostgreSQL/Docker presentes, sin errores de muestreo; artifacts locales en tmp/observability-Gbwp43/export. La captura parcial del navegador también verificó LCP/CLS/INP reales, sin presentar los valores como benchmark. Auditoría de producción cero vulnerabilidades. Conexión real de base habitual correcta: 0 usuarios, 6 categorías, 30 productos y 0 carritos/pedidos/pagos ficticios. Auditoría de 219 archivos revisables sin secretos locales conocidos, enlaces rotos o rutas excluidas; git diff --check correcto. Integraciones opcionales desactivadas en tienda habitual; sin dependencias nuevas, accesos externos, despliegue, k6 ni etapa 6. Cambios sin commit para revisión.

Comprobaciones finales adicionales: script Google bloqueado no consume la reclamación; falta de consentimiento devuelve 403. Bytes de Docker normalizados y ejecutable resuelto por LOCALAPPDATA/PATH/DOCKER_BIN, sin ruta de usuario fija. El log JSON de observabilidad confirma los campos esperados; la sobrecarga bajo carga sigue sin medirse. No se verificó recepción en DebugView de una propiedad real.
