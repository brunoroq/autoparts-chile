# Fase 1.2: generador concurrente local

Estado actualizado: primera carga baja/closed/30 ejecutada una sola vez con autorización053; ver [resultados medidos](first-low-30-results.md). No se determinó capacidad máxima ni se ejecutaron normal/pico. Las restricciones de preparación que siguen describen el protocolo previo: no autorizan repetir ensayos, tocar producción, crear commits/push o desplegar.

Actualización posterior, autorización054: ejecutada una sola [carga normal/closed/30 y comparación con baja](normal-30-results.md), máximo10VU y sin cambios de negocio. Pico continúa pendiente de autorización; no repetir ensayos automáticamente.

Actualización vigente, autorización060: completada una sola [carga pico/closed/30 y comparación de tres escenarios](pico-30-results.md), máximo30VU, sin cambios de datos ni tráfico de producción. Quedan ejecutados baja/normal/pico una vez cada uno para catálogo30. No se determinó capacidad máxima ni se autorizan nuevos ensayos; experiencia de navegador y Web Vitals siguen pendientes de medición específica.

## Aislamiento y requisitos

- k6 Windows v2.3.0, Node 24/npm 11, Docker Desktop Linux y Compose v5.
- Consulta 2026-11-11: k6 v2.3.0 y Compose v5.6.1 presentes; host con 12 CPU lógicas, 15,93 GiB RAM y aproximadamente 5,33 GiB libres. Docker Engine no disponible: pipe dockerDesktopLinuxEngine ausente. No se inició Docker ni contenedores.
- Preparador exige Docker Linux con 4 CPU, 6 GiB asignados y 2 GiB libres en el host. Recomendación: 6–8 GiB para Docker y cerrar programas que compitan por memoria; comprobar disponibilidad antes de cada ensayo.
- Aplicación Node 24.21.0 y PostgreSQL 18.6, cada uno limitado a 2 CPU/2 GiB. PostgreSQL coincide con la versión registrada de Neon; no cambia la versión de la base local habitual.
- Compose exclusivo autoparts-performance: PostgreSQL y preparación en red interna, sin puerto publicado PostgreSQL. Aplicación en red privada y red de ingreso puente, publicada solo en 127.0.0.1:3100. Ingreso sin masquerading IPv4, sin IPv6; DNS externo de aplicación no se reenvía a un resolver público. Cada UUID utiliza un volumen nuevo autoparts-performance-UUID. No monta datos existentes ni elimina volúmenes.
- El build descarga dependencias: la red interna protege servicios en ejecución, no la construcción. `.dockerignore` excluye .env, Git, respaldos, artefactos y datos locales.

## Comandos futuros, sujetos a autorización

Desde autoparts-review-86673f0:

```powershell
# Solo configuración: sin HTTP, servicios ni carga.
npm run perf -- plan --profile baja --catalog 30

# Solo después de autorizar preparación: crea volumen local nuevo,
# aplica migraciones locales y seed; nunca usa conexiones del host.
npm run perf -- prepare --catalog 30 --execute

# Solo después de autorizar carga: copiar UUID emitido por prepare.
npm run perf -- run --run-id <UUID> --profile baja --execute
```

Preparar y ejecutar carga requieren autorizaciones distintas. Primero baja/30; revisar resultados antes de normal o pico. Catálogos 1000/10000 requieren otro UUID y preparación. No se resembran productos de una base con actividad: el preparador comprueba que productos, usuarios, carritos, pedidos y pagos estén vacíos. No hay limpieza automática ni eliminación para reducir catálogo.

El preparador genera secretos locales aleatorios en artifacts/performance/UUID/compose.env, ignorado por Git y Docker context. No contiene credenciales de producción. Permisos 0600 donde se soporten; en Windows conservar ACL privadas. No compartir compose.env ni imprimir docker compose config expandido, porque revela valores. .env.performance.example solo documenta marcadores ficticios.

El UUID de prepare identifica el entorno y volumen. Cada run genera otro UUID de experimento, compartido por app/k6/observador y guardado en plan.json; no mezcla etiquetas de ejecuciones sucesivas. PERF_RUN_ID mantiene el volumen y PERF_EXPERIMENT_ID identifica la ejecución. Un laboratorio existente bloquea otra preparación: detenerlo y revisar manualmente antes de preparar otro, conservando los volúmenes.

## Escenarios

| Perfil | Ramp-up | Meseta | Descenso | Duración nominal |
| --- | --- | --- | --- | --- |
| baja | 1 a 3 VU / 30 s | 3 VU / 120 s | 30 s | 180 s |
| normal | 1 a 10 VU / 60 s | 10 VU / 300 s | 60 s | 420 s |
| pico | 1 a 10 / 60 s; 10 a 30 / 30 s | 30 VU / 60 s | 60 s | 210 s |

Pausas deterministas de 1–3 s; mezcla cíclica por VU/iteración: 40 % navegación, 40 % búsqueda/filtros y 20 % abandono invitado. En ensayos cortos/abortados la proporción obtenida puede diferir; reportar muestra real.

Predeterminado: --model closed, ramping-vus. Alternativo: --model arrival --rate 1, ramping-arrival-rate con pico parametrizable de 1..5 recorridos/s, hasta 30 VU, mismas duraciones y etapas escaladas. No confundir tasa de recorridos con RPS. Registrar dropped_iterations: puede indicar límite del generador o degradación del sistema. No combinar ambos modelos sin aclararlo. VU y duraciones se centralizan en scenarios.js, sin opciones k6 arbitrarias en el runner.

Navegación consulta HTML de inicio/catálogo/detalle y API real. Búsqueda alterna términos con distintas selectividades, filtros, precio, orden y páginas. Abandono mantiene IDs/cantidades en memoria, cotiza una unidad y termina. k6 HTTP no ejecuta React, localStorage, imágenes, GA4 o Web Vitals; no representa la experiencia completa de navegador. Las pruebas funcionales existentes complementan esa cobertura.

Extensión futura: un módulo de compra con cuentas exclusivas de esta base, autenticación normal e idempotencia. Actualmente las rutas de cuentas, merge, checkout, pedidos y pagos están bloqueadas. Añadirlas requiere aprobación y pruebas adicionales; no se implementó un bypass de seguridad.

## Límites y vías alternativas

- URL literal http://127.0.0.1:3100, sin BASE_URL configurable ni resolución DNS. Vercel, Neon y cualquier remoto quedan fuera. Redirecciones desactivadas.
- Antes de k6, el runner verifica marcador de instancia: host/base exclusivos, Analytics apagado, simulador, UUID y catálogo. Cada VU lo verifica nuevamente; --no-setup no lo evita. Fuera del laboratorio /api/performance/status devuelve 404, sin divulgar conexión.
- Lista permitida: GET de páginas/catálogo y POST de cotización no vacía. Se mantiene Origin canónico y la protección CSRF. No registra cuerpos ni credenciales.
- Tope de 30 VU, 600 s y 10000 solicitudes. Los perfiles más margen de arranque/terminación quedan por debajo de 600 s. Se reserva una solicitud para preflight; k6 divide el resto entre VU, cuya suma no supera el tope. Puede detenerse antes sin agotarlo.
- El presupuesto cuenta tráfico del generador y su preflight. Las sondas locales de salud de Docker son tráfico de infraestructura separado; no se incluyen en los resultados HTTP k6. No producen consultas ni escrituras de datos.
- Cada solicitud comprueba VU, presupuesto, vencimiento, ruta y cuerpo. Timeout 5 s, watchdog externo y sin reintentos automáticos.
- active.lock impide dos runners simultáneos. Resultados por perfil/modelo no se sobrescriben. Si el proceso termina abruptamente, verificar el PID antes de retirar manualmente un lock residual.
- Ejecutar directamente k6 run performance/k6/journeys.js falla al inicializar sin PERF_PLAN. El runner emite un plan de vida corta solo con --execute; los límites internos siguen activos aunque se usen opciones fuera del comando. No usar k6 cloud, ejecución distribuida ni reutilizar un plan en varios procesos. El presupuesto es por proceso: no es una barrera contra un operador que edite scripts o fabrique planes. La vía soportada es un runner local único; no se promete imposibilidad de elusión por alguien con control del equipo.
- Errores HTTP/funcionales >=5 % o p95 >=5000 ms abortan tras 30 s. Redirección o marcador incorrecto abortan. Seis muestras consecutivas de CPU >=190 % (2 CPU) o memoria >=95 % por contenedor detienen el ensayo. Fallo del observador también detiene carga. Son límites conservadores, no objetivos de capacidad. Muestreo cada 5 s más el tiempo de captura.
- Ctrl+C permite detener manualmente. No aumentar intensidad automáticamente tras un aborto. No se implementó ejecución cloud ni consume cuotas Vercel/Neon.

## Resultados y observabilidad

Artifacts ignorados: artifacts/performance/UUID/perfil-modelo/.

| Archivo | Contenido |
| --- | --- |
| plan.json, manifest.json | UUID, catálogo, perfil, recursos/versión Docker y k6, commit, árbol sucio, fechas y límites; sin secretos |
| k6.jsonl, k6.csv | Muestras cliente, ruta normalizada y fase; latencias, estados, throughput y volumen |
| summary.json, summary.csv | Promedio, mediana, p90/p95/p99, tasas y contadores |
| application.jsonl, application/ | API y recursos; requests.csv, summary.csv/json y resources.csv/json |
| outcome.json | Código de salida, estado del observador y duración real |

El resumen k6 completo incluye rampas; http_req_duration{phase:steady} separa latencias de meseta. Para throughput/errores de meseta filtrar muestras phase y usar la duración efectiva. El agregado de aplicación utiliza la ventana completa capturada, no solo meseta; no comparar intervalos distintos. Una ejecución abortada puede carecer de resumen final: conservar muestras parciales y reportar aborto. No promediar percentiles entre repeticiones; pocas muestras hacen p99 inestable. El cálculo empírico del exportador puede diferir del de k6.

Node: CPU, RSS/heap, event loop y demora p95. Docker app/PostgreSQL: CPU, memoria, PIDs, red, contadores y tasas por delta de I/O. I/O no equivale a latencia de disco. PostgreSQL: conexiones/activas/locks, commits/rollbacks, bloques leídos/aciertos, temporales, deadlocks y tuplas. Sus contadores son acumulados; restar muestras de misma instancia/ventana y detectar reinicios. Bloques PostgreSQL no equivalen a lecturas físicas. dbMs incluye espera de pool/driver, no solo SQL.

El observador añade una conexión y consultas cada 5 s; medir/documentar su sobrecosto. La conexión observadora se excluye del conteo de actividad de aplicación. Saturación se estudia correlacionando throughput, p95/p99, errores, CPU/memoria, event loop y locks/conexiones. Observar también al generador: comparte host y compite por recursos.

## Diferencias con producción y pendientes

Local usa recursos fijos, procesos persistentes y red próxima. Vercel tiene funciones serverless, CDN, escalamiento y arranques; Neon añade pooling/TLS, suspensión y red São Paulo. Pool local 5 frente a pool cloud pequeño documentado. No inferir capacidad de producción desde los resultados locales.

Analytics apagado, IDs vacíos y tráfico synthetic. PostgreSQL permanece en red interna; la aplicación incorpora red de ingreso sin masquerading. Esta restricción no equivale a un firewall de salida completo: no afirmar aislamiento absoluto de la aplicación respecto del host o de redes que el operador pueda configurar. El generador mantiene destino literal y lista permitida; no se autorizan solicitudes remotas. No se modificó GA4 de producción, consentimiento, autenticación, checkout, pagos, inventario ni migraciones.

Pruebas sin carga: parámetros/destinos, presupuesto, rutas prohibidas, marcador, p90/exportación y entrada directa. k6 inspect solo valida inicialización/opciones; no ejecuta VU ni HTTP. Ver LogFile.txt para resultados de lint/TypeScript/Prisma/unitarias/build.

Pendiente: con Docker activo y otra autorización, construir imagen, levantar entorno, validar red/puerto, seed, persistencia local, métricas/artefactos y primera carga baja. No hay mediciones de capacidad, ensayo real de saturación ni comprobación de apagado bajo carga. No interpretar esta documentación como permiso para ejecutarlos.

## Corrección de acceso Windows, 2026-11-11

La primera preparación creó servicios saludables pero el host recibió ECONNREFUSED. App estaba conectada exclusivamente a lab/internal; HostConfig conservó 3100, pero NetworkSettings no tenía publicación efectiva. `prepare` solo esperaba salud interna y anunció éxito prematuramente.

Corrección: app añade ingress/bridge; puertos explícitos 127.0.0.1:3100:3000 y host_binding_ipv4 loopback, enable_ip_masquerade false e IPv6 desactivado. PostgreSQL/prepare conservan exclusivamente lab. App utiliza DNS local sin resolver público; la resolución del alias postgres sigue funcionando. No hay cambios al firewall global, Docker Desktop, PostgreSQL habitual o restauraciones.

El preparador ahora llama verifyPerformanceEndpoint desde el host antes de prepared true; comprueba HTTP, isolated, UUID y catálogo, sin redirecciones y con timeout5s. La misma función protege run. Las pruebas cubren rechazo HTTP503, marcador equivocado/null y ECONNREFUSED.

Aplicación del cambio al UUID324a39f2-2164-44cc-8276-5ef9defec5db: solo compose up --no-deps --no-build --wait app. Sin repetir prepare, migraciones o seed. Comparación de IDs/StartedAt de los otros cuatro contenedores y huella de Product sin diferencias. GET desde Windows de inicio, aislamiento, productos y categorías200;30productos,6categorías,7migraciones completas y0usuarios/carritos/pedidos/pagos. App y PostgreSQL saludables; publicación efectiva solo127.0.0.1:3100. Memoria libre posterior aproximadamente5,01GiB; consumos app91,92MiB yPG84,59MiB en una muestra.

Verificación: lint, TypeScript, Prisma,38unitarias y build correctos. No se ejecutó k6 (ni inspect en esta corrección), tráfico de carga, compras o escrituras de inventario. Las comprobaciones fueron GET/SELECT y lectura de recursos. Los pasos de preparación pendientes indicados antes quedaron completados para este laboratorio; sigue pendiente autorización y ejecución de cualquier escenario, exportación durante carga y prueba de los límites bajo carga. Ver LogFile.txt.


## Observador GA4 sintético, 2026-11-12

Modo opcional, desactivado por defecto y sin ejecuciones nuevas. Ver [procedimiento del laboratorio Analytics](analytics-laboratory.md). El observador y los VU HTTP son poblaciones distintas; no reenviar resultados anteriores a GA4.
