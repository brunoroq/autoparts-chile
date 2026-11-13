# Primera ejecución baja: 30 productos

Fecha local: 2026-11-11, aproximadamente 22:15:22–22:18:25, America/Santiago (UTC-03). Única ejecución autorizada, sin reintentos ni perfiles normal/pico.

Entorno: 324a39f2-2164-44cc-8276-5ef9defec5db. Experimento: **8018ee58-ceab-4cc5-8220-c99ec8797aff**. Destino literal http://127.0.0.1:3100, PostgreSQL aislado,30productos/6categorías, Analytics apagado y pagos simulados configurados pero no utilizados. k6v2.3.0, Docker29.9.2 Linux/WSL2,12CPU/7,721GiB asignados; aplicación y PostgreSQL limitados individualmente a2CPU/2GiB. Código base decfa361 con árbol de trabajo modificado: no atribuir estos resultados al commit sin incluir los cambios locales de Fase1.2.

Comando ejecutado una sola vez:

```powershell
npm run perf -- run --run-id 324a39f2-2164-44cc-8276-5ef9defec5db --profile baja --execute
```

Modelo closed/ramping-vus; máximo3VU, subida30s, meseta120s y descenso30s. Límite interno9999solicitudes más1preflight del runner, timeout5s, sin redirecciones y watchdog210s. Presupuesto particionado por VU y verificación de marcador por VU. Supervisor de contenedores y vigilancia externa de memoria host con parada a menos2GiB. El runner recreó solo app para etiquetar el nuevo experimento, conservando base y catálogo. No se repitió seed ni migraciones.

## Resultados medidos

Salida0, observador sin fallos, todos los umbrales aprobados. Duración k6182,733s; ventana runner183,110s, que incluye su margen de arranque/cierre. No intercambiar ambos denominadores.

| Latencia HTTP k6, ms | Ejecución completa (439 muestras) | Meseta (333 muestras) |
| --- | ---: | ---: |
| Promedio | 8,633 | 8,026 |
| Mediana | 5,986 | 6,012 |
| p90 | 15,022 | 15,372 |
| p95 | 17,697 | 17,045 |
| p99 | 26,185 | 24,716 |
| Máximo | 171,925 | 32,541 |

439solicitudes del generador, todas200;0HTTP4xx,0HTTP5xx,0fallos de red registrados,0errores funcionales. Throughput completo2,402solicitudes/s según k6. Meseta333/120=2,775solicitudes/s (tasa derivada de conteo medido y ventana configurada).111recorridos completados,0,607recorridos/s;463checks aprobados y0fallidos. El preflight adicional del runner no se incluye en los439; sondas Docker y lecturas previas/posteriores no son tráfico de carga k6.

| Operación normalizada | Solicitudes |
| --- | ---: |
| GET /api/performance/status | 3 |
| GET /api/v1/products (incluye búsquedas/filtros/páginas) | 157 |
| GET /api/v1/categories | 45 |
| GET /api/v1/products/[id] | 82 |
| POST /api/v1/cart/guest | 24 |
| GET / | 43 |
| GET /catalogo | 43 |
| GET /productos/[slug] | 42 |

No hubo rutas de cuentas, merge, checkout, pedidos o pagos. POST solo cotizó una unidad, sin reservar/descontar inventario. Las etiquetas URL del archivo k6 están normalizadas como rutas relativas; el destino efectivo está fijado en script/plan. No son una captura de paquetes de red.

Server-Timing en 308 respuestas instrumentadas: aplicación media 3,111 ms y p95 de 5,773 ms; DB media 2,921 ms y p95 de 5,439 ms. Estas métricas cubren handlers instrumentados y no todo SSR/red; dbMs incluye pool y driver. Los valores autoritativos están en analysis.json y summary.json.

## Recursos muestreados

| Docker (23 muestras por servicio) | CPU promedio/máximo | Memoria promedio/máximo |
| --- | ---: | ---: |
| Aplicación | 3,969% /15,710% | 126,027 /162,700MiB |
| PostgreSQL | 1,406% /6,110% | 85,586 /87,690MiB |

CPU de Docker expresa porcentaje de un núcleo (100%=unCPU), no del límite2CPU ni del host completo. Son promedios aritméticos y máximos de muestras, no picos continuos. Una consulta manual adicional durante la ejecución mostró PostgreSQL6,37%; no pertenece a la serie de23muestras ni se mezcla con su promedio.

Node,36muestras: CPUmedia2,856% de un núcleo y máximo8,205%; RSSmedio198,822MiB y máximo234,063MiB; utilización máxima del event loop0,0493. Demora p95 del loop media20,292ms con resolución de medición20ms; no equivale a latencia HTTP. RSS Node y memoria Docker utilizan contabilidad y tiempos distintos; no sumarlos ni tratarlos como mediciones idénticas.

Host,17muestras durante ejecución: mínimo libre4,754GiB, máximo6,208GiB. La memoria disponible cambió durante el ensayo; no se midió qué proceso externo causó ese cambio. El generador y servicios comparten host.

PostgreSQL,36muestras y ventana174,998s entre extremos: conexiones máximas3 (observador excluido), sin esperas por locks en las instantáneas; delta751commits,0rollbacks,8611aciertos de bloques,0bloques leídos,0temporales y0deadlocks. Las consultas cortas pueden no aparecer como activas en un muestreo periódico: cero activos observados no significa ausencia de actividad.

Docker,ventana178,02s: no se reportaron incrementos de I/O de bloques entre extremos en app o PostgreSQL. No afirmar cero I/O absoluto fuera de esa ventana o del alcance del contador. Caché PostgreSQL ya estaba caliente por preparación/verificaciones previas. Incremento de red app RX1.688.600B/TX6.576.500B; PostgreSQL RX749.000B/TX1.494.000B. Incluye tráfico interno, no solo bytes HTTP del cliente. Errores de recursos/render0 en captura. Sin OOM/reinicios ni indicios observados de saturación; no se alcanzó ni determinó capacidad máxima.

## Integridad y evidencias

SELECT final:30productos,6categorías,0usuarios/carritos/pedidos/pagos. Huella de filas completas Product idéntica antes/después: incluye stock y precios. PostgreSQL laboratorio y tres contenedores anteriores conservaron IDs/StartedAt/estado. No hubo escrituras de compra, inventario, Neon, Vercel o GA4. No se hicieron commits/push/despliegues.

Directorio privado ignorado por Git:

`artifacts/performance/324a39f2-2164-44cc-8276-5ef9defec5db/baja-closed/`

- plan.json,manifest.json,outcome.json: configuración/fechas/estado.
- k6.jsonl,k6.csv: muestras cliente.
- summary.json,summary.csv: agregados oficiales k6.
- application.jsonl y application/summary.json,summary.csv,requests.csv,resources.json,resources.csv,web-vitals.csv: aplicación/infraestructura. No hubo navegador ni muestras de Web Vitals; archivo vacío no equivale a métrica cero.
- host-supervision.json: vigilancia host/contendedores.
- analysis.json: consolidación y SELECT final; code-sha256.json identifica archivos locales relevantes sin secretos.

No compartir compose.env del directorio superior: contiene secretos locales del laboratorio y queda fuera de los reportes.

Limitaciones: una sola ejecución,3VU y catálogo pequeño; p99 tiene pocas observaciones de cola. No representa Vercel/Neon, navegador, carga de imágenes, Core Web Vitals ni experiencia GA4. El resumen conservado no registra explícitamente cuántas iteraciones se interrumpieron durante ramp-down; solo se afirma111completadas, sin inventar cero interrupciones. No se realizaron estimaciones de capacidad ni extrapolaciones a1000/10000productos. No se ejecutaron pruebas adicionales para ampliar la muestra. Esperar autorización para continuar.
