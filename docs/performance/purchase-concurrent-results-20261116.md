# Compras concurrentes simuladas — 16 de noviembre de 2026

Experimento: `635f372f-a8bb-45f8-b97e-4584aec6dd02`. Una sola ejecución, salida 0, sin parada ni reintentos. Entorno `a52a7a92-9b7f-4ae1-a6cf-643a0a25f14f`, exclusivamente `http://127.0.0.1:3102`, base `autoparts_purchase_test`, SIMULATED y Analytics desactivado con IDs vacíos. Preflight inicial: 5,59 GiB libres; final: 6,14 GiB.

## Resultados medidos

10 VUs, una iteración por VU, 10 compras completadas y cero fallos funcionales. Límites autorizados: 10 compras, 500 solicitudes y 90 segundos; no se aumentaron.

| Métrica (ms) | Promedio | p50 | p90 | p95 | p99 |
|---|---:|---:|---:|---:|---:|
| HTTP k6, 140 muestras | 42,532 | 34,294 | 114,255 | 119,535 | 132,220 |
| Recorrido, 10 muestras | 604,2 | 607 | 611,4 | 613,2 | 614,64 |
| DB Server-Timing, 100 muestras | 45,265 | 33,185 | 103,628 | 116,688 | 129,721 |
| Aplicación Server-Timing, 100 muestras | 49,952 | 35,94 | 111,101 | 119,375 | 132,052 |

HTTP: 130 respuestas 200 y 10 respuestas 201; cero 4xx, 5xx o estado 0. Tasa HTTP y tasa funcional de error: 0. Ambos umbrales `rate==0` aprobados. Throughput k6: 227,296 solicitudes/s; 16,235 compras/s nominales durante una ventana muy breve de aproximadamente 0,616 s. No constituyen capacidad sostenida ni un punto de saturación.

Autenticación previa secuencial: 3.118 ms y 40 solicitudes, excluidas de los percentiles y throughput k6. Además, el runner realizó un GET de preflight: 181 solicitudes del procedimiento protegido en total; lecturas preparatorias y posteriores se contabilizan aparte. Iteración: promedio 604,032 ms, máximo 615,938 ms. Transferencia k6: 113.563 bytes enviados y 202.499 recibidos.

## Verificación de datos

- 10 pedidos nuevos PAID, 10 pagos nuevos SIMULATED/APPROVED/AUTHORIZED; totales 11 pedidos y 11 pagos.
- Diez compradores, carritos y claves de idempotencia distintos; un pago y un ítem de cantidad uno por pedido. Importes coherentes con sus ítems: 6.990 CLP por compra.
- AP-SEED-00002: stock 21 → 11, exactamente diez unidades descontadas. Los 30 productos conservan precios, identidad, categoría y disponibilidad; los cambios de stock coinciden con las nuevas compras.
- Diez usuarios, diez carritos, cero CartItem. Pedido, pago e ítems originales sin cambios, incluidos los campos y fechas comparados.
- Siete hashes históricos coincidentes; contenedores con los mismos IDs, estados, fechas de arranque y cero reinicios. Los otros laboratorios ya estaban detenidos y permanecieron así.

## Evidencias y límites

Originales: `artifacts/purchase-results/635f372f-a8bb-45f8-b97e-4584aec6dd02/` (`plan.json`, `summary.json`, `k6.csv`, `k6.jsonl`, `analysis.json`, `outcome.json`). SELECT y manifiestos: `artifacts/purchase-verification/concurrent-20261116/`.

El primer verificador posterior comparó serialización compacta contra JSON indentado y marcó falsamente `containersUnchanged=false`. Se conserva ese resultado y se añade `containers-readback.json`, que compara valores parseados y confirma igualdad. No fue un error de la aplicación ni motivó repetir compras.

El destino local se acredita mediante código restringido, plan, configuración, marcador y aislamiento de red; las etiquetas métricas son relativas y no prueban por sí solas un destino observado. No hubo captura independiente de paquetes ni acceso de comprobación a bases externas. No se usó transporte GA4/Transbank: Analytics apagado, proveedor simulado y rutas locales permitidas. No afirmar una auditoría de contenido de Neon o Vercel.

La prueba acredita diez compras independientes concurrentes y consistencia agregada de stock en este laboratorio. No acredita reenvíos de la misma clave, disputa por la última unidad, capacidad sostenida, percentiles representativos con diez recorridos, pagos Webpay ni resultados de producción. No comparar directamente sus métricas con la prueba de 1 VU, cuyo login estaba dentro de k6.
