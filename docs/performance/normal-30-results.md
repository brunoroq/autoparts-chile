# Carga normal sostenida: 30 productos

Ejecución única autorizada. Inicio local 2026-11-11 22:26:52; cierre 2026-11-11 22:33:56, America/Santiago (UTC-03). No se ejecutó pico ni se repitió baja.

Entorno: 324a39f2-2164-44cc-8276-5ef9defec5db. Experimento normal: **168dd82a-8439-434d-91c4-ae3d032d908e**. Comparación baja: 8018ee58-ceab-4cc5-8220-c99ec8797aff. Destino literal http://127.0.0.1:3100, PostgreSQL privado y Analytics apagado. Inventario y datos coincidentes con el cierre de baja antes de iniciar. Código de 140 archivos igual al usado en baja; árbol de trabajo sin commit, código base decfa361. No atribuir estos resultados al commit sin los cambios locales.

Comando ejecutado una sola vez:

```powershell
npm run perf -- run --run-id 324a39f2-2164-44cc-8276-5ef9defec5db --profile normal --execute
```

Modelo closed/ramping-vus, hasta 10 VU, subida 60 s, meseta 300 s y descenso 60 s. Plan nuevo, máximo 9999 solicitudes k6 más un preflight, timeout 5 s, sin redirecciones y watchdog 450 s. Umbrales de error HTTP/funcional 5 % y p95 5000 ms tras 30 s; supervisión Docker, salud y memoria host >=2 GiB. Solo app recreada para etiquetar el experimento; no se repitieron migraciones o seed.

## Resultados completos y comparación

Salida 0; duración k6 423,108 s frente a 182,733 s de baja. Ventana del runner 423,528 s, sin fallos del observador. Los denominadores del runner y k6 no son idénticos. Máximo de VU observado: 10; todos los umbrales aprobados.

| Latencia, ms | Baja | Normal | Diferencia, ms | Diferencia % |
| --- | ---: | ---: | ---: | ---: |
| Promedio | 8,633 | 6,495 | -2,138 | -24,77 % |
| Mediana | 5,986 | 5,077 | -0,909 | -15,19 % |
| p90 | 15,022 | 11,309 | -3,714 | -24,72 % |
| p95 | 17,697 | 12,583 | -5,113 | -28,89 % |
| p99 | 26,185 | 18,252 | -7,933 | -30,30 % |

## Meseta

Normal: 2763 solicitudes en 300 s. Baja: 333 en 120 s. Las siguientes tasas se derivan de conteos medidos y las ventanas de meseta configuradas; no son estimaciones de capacidad.

| Latencia, ms | Baja | Normal | Diferencia, ms | Diferencia % |
| --- | ---: | ---: | ---: | ---: |
| Promedio | 8,026 | 6,283 | -1,743 | -21,71 % |
| Mediana | 6,012 | 4,982 | -1,030 | -17,13 % |
| p90 | 15,372 | 11,171 | -4,201 | -27,33 % |
| p95 | 17,045 | 12,194 | -4,851 | -28,46 % |
| p99 | 24,716 | 16,095 | -8,621 | -34,88 % |

| Tráfico | Baja | Normal | Diferencia absoluta | Diferencia % |
| --- | ---: | ---: | ---: | ---: |
| Solicitudes/s, ejecución completa | 2,402 | 7,946 | +5,544 | +230,75 % |
| Solicitudes/s, meseta | 2,775 | 9,210 | +6,435 | +231,89 % |
| Solicitudes totales | 439 | 3.362 | +2.923 | +665,83 % |
| Recorridos completados | 111 | 850 | +739 | +665,77 % |
| Recorridos/s | 0,607 | 2,009 | +1,402 | +230,72 % |

Los totales no son directamente comparables como capacidad: normal duró más y utilizó más VU. Usar las tasas y aclarar mezcla y ventanas. Los percentiles completos incluyen rampas y primeros accesos tras recrear app. No se supone que los máximos o p99 correspondan a consultas equivalentes.

## Errores y operaciones

Estados HTTP normal: 3.362 respuestas 200. Cero HTTP 4xx, HTTP 5xx, errores de red y errores funcionales, igual que en baja. Cuando la base es cero no se calcula diferencia porcentual; se conserva null en JSON y vacío en CSV. Checks normal: 3.532 aprobados y 0 fallidos. El resumen registra 850 recorridos completados; no conserva un contador explícito de interrumpidos durante descenso, por lo que no se inventa cero interrupciones.

| Operación normalizada | Solicitudes normal |
| --- | ---: |
| GET /api/performance/status | 10 |
| GET /api/v1/products | 1192 |
| GET /api/v1/products/[id] | 625 |
| POST /api/v1/cart/guest | 170 |
| GET / | 342 |
| GET /catalogo | 342 |
| GET /productos/[slug] | 341 |
| GET /api/v1/categories | 340 |

Solo GET permitidos y POST de cotización invitada; no cuentas, merge, checkout, pedidos o pagos. Las cotizaciones consultan precios/stock del servidor y no reservan inventario. Sondas de salud y preflight no forman parte del contador HTTP del generador. Las etiquetas URL k6 se normalizan como rutas relativas; el destino fijo se valida en plan/script, no por una captura de paquetes.

## Recursos y saturación

| Docker | Muestras por servicio | CPU promedio / máximo muestreado | RAM promedio / máximo |
| --- | ---: | ---: | ---: |
| app | 53 | 7,867 / 24,010 % | 173,808 / 206,500 MiB |
| postgres | 53 | 1,829 / 7,640 % | 85,896 / 89,700 MiB |

CPU Docker 100 %=un núcleo, no todo el host ni el límite de 2 CPU. Las diferencias porcentuales de CPU comparan porcentajes muestreados; su diferencia absoluta corresponde a puntos porcentuales. Los promedios son aritméticos por muestra, no integración continua.

| Recurso | Baja | Normal | Diferencia absoluta | Diferencia % |
| --- | ---: | ---: | ---: | ---: |
| Aplicación: CPU media (%) | 3,969 | 7,867 | +3,899 puntos | +98,24 % |
| Aplicación: CPU máxima muestreada (%) | 15,710 | 24,010 | +8,300 puntos | +52,83 % |
| Aplicación: RAM máxima (MiB) | 162,700 | 206,500 | +43,800 | +26,92 % |
| PostgreSQL: CPU media (%) | 1,406 | 1,829 | +0,423 puntos | +30,12 % |
| PostgreSQL: CPU máxima muestreada (%) | 6,110 | 7,640 | +1,530 puntos | +25,04 % |
| PostgreSQL: RAM máxima (MiB) | 87,690 | 89,700 | +2,010 | +2,29 % |
| PostgreSQL: conexiones máximas | 3 | 4 | +1 | +33,33 % |

I/O Docker: app delta lectura/escritura 0/0 bytes en 419,206 s; PostgreSQL 0/300000 bytes en 419,208 s. Los ceros no prueban ausencia de I/O fuera del alcance/ventana. Catálogo caliente, sin ensayo de disco frío. Tráfico de red incluye app-DB y observabilidad: app RX/TX 13085500/51884800 bytes; PostgreSQL 5640000/11420000 bytes.

La escritura de bloques PostgreSQL no equivale a cambios de inventario ni pedidos: las huellas de datos de negocio permanecen iguales. No se instrumentó el origen individual de esos bytes; no atribuirlos a una operación SQL concreta. Frente a cero bytes en baja, la diferencia absoluta es +300.000 B y la porcentual no está definida.

Node: 84 muestras; CPU media/máxima 5,576/9,383 % de un núcleo; RSS media/máxima 246,093/269,719 MiB. Utilización máxima del event loop 0,0729, demora p95 del loop media 20,468 ms con resolución 20 ms. RSS Node y memoria Docker tienen distinta contabilidad; no sumarlos.

Host: 42 muestras de RAM libre, 4,800–6,697 GiB; condición previa >=2 GiB cumplida. Comparten host generador/app/DB. La variación de memoria libre no identifica su causa ni prueba ausencia de procesos externos.

PostgreSQL: 84 muestras y ventana 414,997 s; conexiones máximas 4, activos máximos observados 1, esperas de locks máximas 0. Deltas: {"xact_commit":5263,"xact_rollback":0,"blks_read":0,"blks_hit":33622,"temp_files":0,"temp_bytes":0,"deadlocks":0,"tup_returned":156770,"tup_fetched":13861}. El observador se excluye del conteo de conexiones de aplicación. Consultas breves pueden no capturarse activas entre muestras. Los contadores absolutos crecen también con la duración y el observador; no compararlos como tasas sin normalizar.

Server-Timing normal: app media 2,179 ms/p95 3,834 ms; DB media 2,042 ms/p95 3,657 ms. Solo respuestas instrumentadas; no todo SSR o red. DB incluye pool/driver, no es tiempo SQL puro. Errores del recolector 0, render 0. Ambos servicios quedaron saludables, sin OOM o reinicios de proceso. No se observaron señales de saturación ni incumplimientos de umbrales; no se determina capacidad máxima con este único nivel.

## Integridad y evidencias

SELECT final: 30 productos, 6 categorías, 0 usuarios, 0 carritos, 0 pedidos y 0 pagos. Huella de filas completas Product idéntica a la previa y a baja: stock/precios sin cambios. PostgreSQL del laboratorio y los tres contenedores anteriores conservaron identificadores, tiempos de inicio y estado. Sin compras, escrituras de inventario, Neon/Vercel/GA4 producción, commits/push/despliegues.

Directorio ignorado: `artifacts/performance/324a39f2-2164-44cc-8276-5ef9defec5db/normal-closed/`. Archivos plan.json, manifest.json, outcome.json, k6.jsonl, k6.csv, summary.json, summary.csv, application.jsonl, host-supervision.json, analysis.json, comparison-low.json/csv y code-sha256.json. En application/: summary.json/csv, requests.csv, resources.json/csv y web-vitals.csv sin muestras de navegador. No compartir compose.env del nivel superior.

Una ejecución por condición, duraciones y tamaños muestrales distintos, cachés calientes y mezcla finita de recorridos. Las diferencias son descriptivas, no significancia estadística ni efecto causal atribuible solo a concurrencia. No representa Vercel/Neon, navegador, imágenes, GA4 o Core Web Vitals. No se estima capacidad ni se autoriza pico. Esperar aprobación antes de cualquier otra ejecución.
