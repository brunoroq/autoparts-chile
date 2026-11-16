# Evidencias originales de compra simulada k6

Anexo público preparado localmente el 16 de noviembre de 2026. Los enlaces relativos permitirán descargar los archivos cuando este anexo sea publicado. No se ejecutaron pruebas para preparar este paquete.

## Método y entorno

Aplicación Next.js y PostgreSQL locales aislados en `127.0.0.1:3102`, base exclusiva de pruebas, 30 productos y cuentas sintéticas independientes. Proveedor SIMULATED; Analytics desactivado y ambos IDs vacíos. Recorrido: autenticación, producto, carrito, checkout con versión e idempotencia, aprobación simulada y consulta del pedido, carrito y producto. Ninguna llamada de pago externo ni evento GA4 forma parte del recorrido.

Cada carpeta conserva byte por byte los resultados existentes. El UUID de experimento y el UUID del entorno en plan.json identifican mediciones; no son credenciales. Los planes están caducados y no deben reutilizarse. No se incluyen configuración privada, cookies, contraseñas, snapshots SQL ni identificadores de las cuentas/pedidos.

| Ensayo | Experimento | Compras | HTTP k6 | Errores | Stock SKU AP-SEED-00002 |
|---|---|---:|---:|---:|---|
| 1 VU | 206d0db0-457c-48a6-a93b-dc93e0a95b71 | 1 | 17 | 0 | 22 → 21 |
| 10 VUs | 635f372f-a8bb-45f8-b97e-4584aec6dd02 | 10 | 140 | 0 | 21 → 11 |

La prueba de 1 VU incluye login dentro de k6. La de 10 VUs prepara sesiones secuencialmente antes de k6: 40 solicitudes y 3.118 ms, separados del resumen HTTP. No comparar directamente los totales de ambos métodos. En ambos casos se validaron pedidos PAID y pagos SIMULATED/APPROVED/AUTHORIZED mediante lectura local; los snapshots privados no se publican.

## Descargas originales

| Archivo | 1 VU | 10 VUs |
|---|---|---|
| Resumen k6 | [summary.json](1vu/summary.json) | [summary.json](10vu/summary.json) |
| Plan efectivo | [plan.json](1vu/plan.json) | [plan.json](10vu/plan.json) |
| Salida del runner | [outcome.json](1vu/outcome.json) | [outcome.json](10vu/outcome.json) |
| Puntos CSV | [k6.csv](1vu/k6.csv) | [k6.csv](10vu/k6.csv) |
| Puntos JSONL | [k6.jsonl](1vu/k6.jsonl) | [k6.jsonl](10vu/k6.jsonl) |
| Análisis de rutas | [analysis.json](1vu/analysis.json) | [analysis.json](10vu/analysis.json) |

[Manifiesto SHA-256](sha256.json): cubre exclusivamente estos doce archivos públicos, con tamaño y experimento. No contiene referencias a archivos privados. No incluye su propio hash ni el README, para evitar circularidad; sus doce entradas son las fuentes métricas publicadas. El analysis.json de 1 VU proviene del posprocesado offline posterior, separado del directorio original; no reemplaza ningún resultado. Las etiquetas URL relativas no demuestran por sí solas un destino de red.

Los doce archivos suman 1.134.272 bytes. Unidades de latencia: milisegundos; tasas: por segundo. Los campos de tiempo numéricos del plan están en milisegundos Unix. Los detalles y limitaciones están en la [auditoría funcional](../../auditoria-compra-k6-2026-11-16.md) y el [reporte concurrente](../../performance/purchase-concurrent-results-20261116.md).

## Interpretación y límites

Son comprobaciones funcionales breves, no capacidad sostenida ni umbrales de saturación. Diez claves distintas no prueban reintentos de la misma clave ni venta de la última unidad. La autenticación previa fue secuencial. Los percentiles de diez recorridos tienen escaso alcance estadístico. No son los ensayos históricos de navegación 3/10/30 VUs ni los de Matías 10/500 VUs. Ninguna compra simulada representa dinero real o conversión GA4.

La salida del primer ensayo no tiene analysisValid porque el analizador aún no estaba incorporado al runner. Su análisis separado acredita las 17 solicitudes. El falso negativo de comparación JSON de contenedores de la segunda prueba se documentó en el reporte; no afectó la compra ni dio lugar a reintentos.

Para verificar integridad sin servicios externos: calcular SHA-256 de cada ruta relativa a esta carpeta y comparar con sha256.json. Los originales privados históricos y sus manifiestos permanecen intactos fuera de este anexo.
