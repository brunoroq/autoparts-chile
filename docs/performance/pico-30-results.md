# Pico de carga: 30 productos y hasta 30 VU

Única ejecución autorizada, modelo closed. Fecha local: 2026-11-11, aproximadamente 23:19:09–23:22:43, America/Santiago (UTC-03). No hubo repeticiones, compras ni tráfico de prueba contra producción.

Entorno: `324a39f2-2164-44cc-8276-5ef9defec5db`. Experimento: **`22672790-ca60-4917-aa80-6c8522ac2448`**. Destino literal: `http://127.0.0.1:3100`; PostgreSQL privado, Analytics apagado, tráfico synthetic. Catálogo y huella de Product coincidieron con cierre de normal antes de empezar. Mismos 140 archivos de código e imagen que en baja/normal. Código base decfa361 con cambios locales sin commit: conservar sus huellas para reproducir, no atribuir resultados al commit por sí solo.

```powershell
npm run perf -- run --run-id 324a39f2-2164-44cc-8276-5ef9defec5db --profile pico --execute
```

## Seguridad y ejecución

Preflight: Docker operativo, ambos servicios healthy y 4,237 GiB libres en host. Perfil: 60 s de 1 a 10 VU, 30 s hasta 30 VU, meseta de 60 s a 30 VU y descenso de 60 s. Plan nuevo con máximo 30 VU, 9999 solicitudes más un preflight del runner, timeout 5 s y watchdog 240 s. Lista de operaciones/destino y redirecciones bloqueadas. Observador Docker con umbrales de CPU/memoria, errores HTTP/funcionales y latencia; supervisión externa de salud y RAM host con parada bajo 2 GiB.

Máximo observado: 30 VU. Salida 0, todos los umbrales aprobados, sin fallos del observador. No se activaron paradas de seguridad. La aplicación se recreó únicamente para etiquetar el experimento; PostgreSQL, volumen y datos no se recrearon. No se repitieron migraciones ni seed.

Duración k6: 213,638 s. Ventana runner: 214,011 s. Ambos incluyen sus respectivos márgenes de inicio/cierre; no usar denominadores indistintamente.

## Resultados medidos

| Latencia HTTP | Ejecución completa (3.388 muestras) | Meseta completa (1.645 muestras) |
| --- | ---: | ---: |
| Promedio | 7,636 ms | 7,906 ms |
| Mediana | 5,549 ms | 5,840 ms |
| p90 | 13,514 ms | 14,220 ms |
| p95 | 16,853 ms | 18,099 ms |
| p99 | 25,582 ms | 27,059 ms |
| Máximo | 215,851 ms | 61,108 ms |

3.388 solicitudes del generador, todas HTTP 200; throughput global 15,859 solicitudes/s. Meseta completa: 1.645/60 = 27,417 solicitudes/s. Se completaron 846 recorridos (3,960/s), con 3.562 checks aprobados y cero fallidos. Cero HTTP 4xx/5xx, errores de red y funcionales. El resumen no conserva contador explícito de iteraciones interrumpidas durante descenso: no inventar cero interrupciones. Preflight y sondas Docker no se cuentan como solicitudes k6.

Operaciones: 30 GET de aislamiento, 1.186 GET de listado/búsqueda/filtros, 334 GET de categorías, 633 GET de detalle API, 174 POST de cotización invitada, 344 GET de inicio, 344 GET de catálogo y 343 GET de detalle HTML. No hubo endpoints de cuentas, merge, checkout, pedidos o pagos. Las cotizaciones no reservan ni descuentan stock.

Server-Timing, 2.327 respuestas: aplicación media 2,716 ms/p95 6,488 ms; DB media 2,572 ms/p95 6,350 ms. Son handlers instrumentados, no todo SSR/red, y DB incluye espera del pool/driver.

## Comparación de los tres perfiles

Los recorridos completos tienen duraciones diferentes. Los siguientes totales describen cada ejecución, no una comparación de capacidad con igual exposición:

| Perfil | Duración k6 | Solicitudes | Recorridos completos | Solicitudes/s globales |
| --- | ---: | ---: | ---: | ---: |
| Baja | 182,733 s | 439 | 111 | 2,402 |
| Normal | 423,108 s | 3.362 | 850 | 7,946 |
| Pico | 213,638 s | 3.388 | 846 | 15,859 |

Para una comparación temporal equivalente se usó la siguiente regla reproducible: hasta 60 segundos completos cubiertos por los registros de las tres mesetas, anclados al primer HTTP completado y etiquetado steady de cada ejecución. La cobertura común produjo **59 segundos**. Se excluye el extremo final. No se inventó una sincronización subsegundo con el inicio del escenario.

Percentiles recalculados desde las muestras mediante interpolación lineal; no son los percentiles de las mesetas completas ni promedios de percentiles.

| Ventana equivalente de 59 s | Baja, 3 VU | Normal, 10 VU | Pico, 30 VU |
| --- | ---: | ---: | ---: |
| Solicitudes | 166 | 545 | 1.613 |
| Solicitudes/s | 2,814 | 9,237 | 27,339 |
| Recorridos completados dentro de ventana | 41 | 143 | 408 |
| Promedio | 8,620 ms | 6,315 ms | 7,926 ms |
| Mediana | 6,290 ms | 5,160 ms | 5,847 ms |
| p90 | 15,937 ms | 11,540 ms | 14,319 ms |
| p95 | 17,783 ms | 12,410 ms | 18,267 ms |
| p99 | 24,950 ms | 13,925 ms | 27,434 ms |
| Errores HTTP | 0 | 0 | 0 |

Ventanas UTC reproducibles: baja 01:15:52.143–01:16:51.143; normal 01:27:52.721–01:28:51.721; pico 02:20:39.417–02:21:38.417, todas del 2026-11-12 UTC (2026-11-11 en Santiago).

Pico frente a normal en estas ventanas: throughput +18,102 solicitudes/s (+195,96 %); media +1,611 ms (+25,51 %); mediana +0,687 ms (+13,31 %); p90 +2,779 ms (+24,08 %); p95 +5,857 ms (+47,19 %); p99 +13,509 ms (+97,01 %). Frente a baja: throughput +24,525 solicitudes/s (+871,69 %), p95 +0,483 ms (+2,72 %) y p99 +2,483 ms (+9,95 %). Comparación en comparison-three.json/csv y diferencias en comparison-three.json/comparison-deltas.csv.

Recursos capturados dentro de esas mismas ventanas, sin reutilizar máximos de ejecuciones completas:

| Ventana de 59 s | Baja | Normal | Pico |
| --- | ---: | ---: | ---: |
| Muestras Docker por servicio | 7 | 7 | 8 |
| CPU media app | 4,700 % | 9,620 % | 22,541 % |
| RAM máxima muestreada app | 120,500 MiB | 169,100 MiB | 219,700 MiB |
| CPU media PostgreSQL | 1,860 % | 1,607 % | 2,832 % |
| RAM máxima muestreada PostgreSQL | 87,470 MiB | 85,710 MiB | 91,860 MiB |
| Conexiones máximas PostgreSQL en sus instantáneas | 3 | 2 | 5 |

Las ventanas tienen igual duración, pero las capturas periódicas no coinciden exactamente en instante o número; registrar sus tamaños muestrales. No interpretar la menor CPU o número de conexiones instantáneas de normal como ausencia de consultas o mejora causal.

Una ejecución por condición, tamaños muestrales distintos, catálogo caliente y host compartido. La mezcla finita puede diferir ligeramente. Las diferencias son descriptivas; no prueban significancia estadística ni causalidad exclusiva de concurrencia. Las latencias de baja no son una referencia de disco frío ni de Vercel/Neon.

## Recursos y saturación

| Docker, 27 muestras por servicio | CPU media / máxima muestreada | RAM media / máxima |
| --- | ---: | ---: |
| Aplicación | 13,809 % / 32,370 % | 173,637 / 224,500 MiB |
| PostgreSQL | 2,553 % / 9,280 % | 88,331 / 91,860 MiB |

CPU Docker 100 %=un núcleo, no todo el host ni el límite de 2 CPU. Los máximos son de muestras; los promedios no son integraciones continuas. Los recursos de la tabla cubren el perfil completo, no exclusivamente los 59 s equivalentes.

Máximos de RAM app baja/normal/pico: 162,7/206,5/224,5 MiB. CPU máxima muestreada app: 15,71/24,01/32,37 %. PostgreSQL: RAM máxima 87,69/89,70/91,86 MiB y CPU máxima 6,11/7,64/9,28 %. Sus ventanas y números de muestras son distintos; no presentar estos máximos como una comparación con igual exposición.

Node, 42 muestras: CPU media 11,212 % y máxima 21,944 % de un núcleo; RSS media 244,678 MiB y máxima 295,184 MiB. Event loop: utilización máxima 0,1684; demora p95 media 20,824 ms y máxima muestreada 22,741 ms, con resolución 20 ms. No sumar RSS Node y memoria Docker: difieren en contabilidad/instante.

Host, 21 muestras: RAM libre 3,744–4,404 GiB. No se incumplió el mínimo de 2 GiB en muestras observadas. El generador comparte host; no se controlaron otros procesos para afirmar causalidad.

I/O Docker, ventana 209,649 s: sin incremento reportado de bloques leídos/escritos en ambos servicios. Esto no prueba ausencia de I/O fuera de la ventana/alcance del contador. En normal se reportaron 300.000 B de escritura PostgreSQL; la base cero de los otros perfiles impide diferencias porcentuales útiles y las duraciones difieren. Red app RX/TX 13.088.600/52.086.500 B; PostgreSQL 5.580.000/11.500.000 B, incluye tráfico interno y observador.

PostgreSQL, 42 muestras/205,001 s: conexiones máximas 5 (baja 3, normal 4), activos máximos observados 1, esperas de locks 0. Deltas: 5.147 commits, cero rollbacks, 30.817 aciertos de bloques, cero bloques leídos, temporales y deadlocks. Alcanzar cinco conexiones coincide con el pool configurado; no se midió directamente la cola de espera del pool, por lo que no demuestra por sí solo saturación. Las consultas breves pueden no aparecer activas en las instantáneas.

No hubo errores de recursos/render, OOM, reinicios ni incumplimiento de umbrales. Subieron las latencias de cola p95/p99 frente a normal y la utilización del event loop, pero no se observó un punto de fallo o saturación sostenida. **No se determinó la capacidad máxima del sistema.** No aumentar carga automáticamente.

## Integridad, artefactos y límites

SELECT final: 30 productos, seis categorías y cero usuarios, carritos, pedidos o pagos. Huella de filas completas Product idéntica antes/después y a los cierres baja/normal: precios, stock y datos de productos intactos. PostgreSQL laboratorio y tres contenedores anteriores conservaron IDs, tiempos de inicio y estado. Solo app se recreó para etiquetar la ejecución; ambos servicios quedan saludables.

Directorio ignorado: `artifacts/performance/324a39f2-2164-44cc-8276-5ef9defec5db/pico-closed/`.

- plan.json, manifest.json, outcome.json: configuración, fechas y estado.
- k6.jsonl/k6.csv y summary.json/summary.csv: muestras y agregados del generador.
- application.jsonl y application/requests.csv, summary.json/csv, resources.json/csv: API e infraestructura.
- host-supervision.json y analysis.json: supervisión y consolidación con verificación de integridad.
- comparison-three.json/csv: ventanas comunes y comparación de los tres perfiles.
- comparison-deltas.csv: diferencias absolutas y porcentuales HTTP entre condiciones.
- code-sha256.json: huellas de código e imagen.

web-vitals.csv no contiene muestras de navegador: no convertir ausencia a valores cero de LCP/INP/CLS. No compartir compose.env del nivel superior. No se enviaron eventos GA4; no se ejecutó tráfico contra Vercel o Neon ni compras, pagos, migraciones, seed, commits/push/despliegues. Las tres ejecuciones HTTP no miden experiencia de navegador, GA4 o Core Web Vitals. Esperar autorización antes de cualquier otra operación.
