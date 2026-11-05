# Etapa 5: analítica, Web Vitals y observabilidad

Implementación aprobada por prompt 013. No incluye k6, despliegue, acceso del profesor ni otras funcionalidades comerciales. Sin dependencias nuevas. La tienda habitual permanece con todas las integraciones opcionales desactivadas por defecto. GA4 es medición de navegador de mejor esfuerzo; PostgreSQL sigue siendo la fuente de verdad para pedidos y conversiones.

## Configuración de GA4 y DebugView

1. En la cuenta de Google del propietario, crear una propiedad de evaluación GA4 y un flujo web. Elegir zona America/Santiago y moneda CLP. Usar la URL que corresponda al entorno; no se desplegó la tienda. No ingresar nombres de clientes en nombres de experimentos ni de propiedad.
2. Copiar el identificador público `G-...` a GA4_MEASUREMENT_ID en `.env`. No se utiliza Measurement Protocol ni API secret. Mantener una propiedad distinta para navegadores sintéticos y configurar su ID en GA4_SYNTHETIC_MEASUREMENT_ID.
3. En el flujo web, desactivar la medición mejorada automática: cambios del historial, búsquedas, formularios y otros eventos que puedan capturar texto libre/URLs. La aplicación controla page_view con send_page_view=false; eso solo no desactiva el seguimiento independiente del historial. Confirmar esta configuración antes de habilitar la propiedad.
4. Configurar ANALYTICS_ENABLED=true y GA4_DEBUG=true para la comprobación manual. APP_ENV=local, TRAFFIC_KIND=human y EXPERIMENT_ID con UUID nuevo. Reiniciar Next.js. No es necesario reconstruir para estos valores de servidor; los entrega el layout dinámico. Mantener secretos privados fuera de Git.
5. Abrir http://localhost:3000 y aceptar analítica. Antes de aceptar, sin ID válido o con ANALYTICS_ENABLED=false no se carga gtag.js ni se realiza una reclamación de purchase. Rechazar conserva la preferencia local. Preferencias de analítica permite retirarla, borrar cookies GA del host y recargar para descargar el script; no afecta la sesión de autenticación. El consentimiento es una preferencia técnica local, no una certificación legal de cumplimiento.
6. En GA4 abrir Administrar → Visualización de datos → DebugView (la traducción del menú puede variar). Navegar por detalle, agregar cantidad, entrar a checkout y confirmar un pago simulado. Comprobar view_item, add_to_cart, begin_checkout y purchase; verificar CLP, value, items y transaction_id. Revisar también Tiempo real y solicitudes de red. El modo debug por sí solo no garantiza entrega ni visibilidad inmediata.
7. Recargar el pedido y abrir otra pestaña: no debe reclamarse otra compra. Para una nueva comprobación usar un pedido nuevo; no borrar automáticamente marcas ni pedidos. Un bloqueo de Google impide la reclamación si el script no llegó a estar listo. Una pérdida posterior puede perder el evento.
8. Desactivar GA4_DEBUG al terminar. Registrar dimensiones personalizadas de alcance evento para environment, traffic_kind y, si hace falta, experiment_id; considerar su cardinalidad y los límites de la propiedad. Revisar la configuración de eventos clave de purchase. No se vincula Google Ads ni se habilitan señales o personalización publicitaria.

No se creó/configuró una propiedad real ni se comprobó DebugView contra Google en esta sesión: falta el identificador del propietario. Los tests usan un ID ficticio y sustituyen el script por un transporte interceptado. No se concedieron accesos externos.

Fuentes primarias: [vistas manuales y cambios del historial](https://developers.google.com/analytics/devguides/collection/ga4/views?technology=websites), [consentimiento básico](https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic), [comercio electrónico](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce).

## Eventos, privacidad y deduplicación

| Evento | Fuente y momento | Identidad para evitar repetición |
| --- | --- | --- |
| view_item | Producto real del detalle, visible tras hidratación/consentimiento | Producto y precio, por sesión de pestaña |
| add_to_cart | Respuesta de mutación exitosa; cantidad agregada y precio actuales del servidor | Identificador aleatorio de esa respuesta |
| begin_checkout | Snapshot de carrito real | Versión y líneas/precios, por sesión de pestaña |
| purchase | Snapshot persistido de un pedido PAID | transaction_id = UUID del pedido, más reclamación atómica persistente |

Los eventos incluyen solo currency, value y items con item_id, price y quantity; purchase añade transaction_id. No se envían nombres de productos libres, nombres/correos de cuentas, user_id, contraseñas, hashes, tokens, cookies de sesión o referencias externas de pago. Las rutas y títulos se normalizan y se descartan consultas y referrer. Los IDs de producto/pedido no autentican al usuario ni contienen información personal. Google puede utilizar sus propios identificadores seudónimos/cookies tras el consentimiento; no se promete anonimato frente al proveedor externo.

La deduplicación de vistas/inicio de checkout es deliberadamente conservadora: una vez por clave en la sesión de pestaña, incluso tras recargar. No representa exactamente el concepto de sesión de GA4. La memoria de eventos está acotada y sessionStorage conserva hasta 500 claves de comercio; sin almacenamiento disponible, las vistas solo se deduplican en memoria. La compra mantiene su protección en PostgreSQL.

POST `/api/v1/orders/[id]/analytics-purchase` requiere sesión, propiedad del pedido, Origin correcto, analítica habilitada y header X-Analytics-Consent=granted. Una actualización condicional PAID + analyticsPurchaseClaimedAt=null permite una reclamación; las demás devuelven data:null. El header comunica la elección del cliente, no constituye prueba criptográfica del consentimiento. No habilita acceso a pedidos ajenos. El UUID de pedido permanece estable como transaction_id.

**La marca persistente significa reclamación para un intento de envío; no confirma recepción por Google.** No hay colas ni reintentos automáticos. Una caída después de reclamar puede subregistrar la compra; no se deshace el pedido ni se vuelve a emitir automáticamente. Es una estrategia de como máximo un intento desde la aplicación. GA4 también deduplica por transaction_id; no sustituye la integridad del servidor. [Referencia oficial](https://support.google.com/analytics/answer/12313109?hl=en).

## Informes de negocio y acceso de lectura

Configurar reportes con sesiones, tiempo de interacción, tasa de interacción, rebote y sesiones con evento clave purchase. Construir embudo detalle → carrito → checkout → compra y contrastar los pedidos PAID de PostgreSQL con los purchase observados. No emitir manualmente session_start o user_engagement: los gestiona gtag cuando está habilitado. En GA4 una sesión con interacción supera el umbral configurado, contiene un evento clave o al menos dos vistas; rebote es el complemento de interacción, no la tasa de errores HTTP. Las compras son de demostración, sin ingresos reales. [Definiciones](https://support.google.com/analytics/answer/12195621?hl=en).

Acceso del profesor, solo después de autorización y correo confirmado: Administrar → Gestión de accesos de la propiedad → Agregar usuario → Lector/Viewer. Otorgar acceso a la propiedad académica, sin rol Editor/Administrador ni acceso a toda la cuenta. Confirmar recepción y visibilidad de informes, conservar evidencia sin direcciones personales en el repositorio. No aplicar restricciones de ingresos si impedirían revisar los valores ficticios requeridos para la evaluación. [Roles oficiales](https://support.google.com/analytics/answer/9305587?hl=en).

## Fuentes técnicas y unidades

| Fuente | Medición | Unidad y alcance |
| --- | --- | --- |
| GA4 | Sesiones, engagement, rebote y embudo | Visitantes consentidos; puede haber bloqueos y demoras |
| Next/useReportWebVitals | LCP, INP, CLS | LCP/INP ms; CLS score sin unidad. Documento de navegador, no cada navegación suave |
| Servidor/API | app, db, auth, hash, provider y estados | ms observados por aplicación; db incluye espera de conexión/bloqueo |
| Node | CPU, RSS, heap, event loop | CPU % de un núcleo (puede superar 100); memoria bytes; utilización 0–1; demora p95 ms |
| PostgreSQL | Conexiones, activas y esperando locks | Base actual, según visibilidad del rol; excluye conexión del observador |
| Docker/PostgreSQL | CPU, memoria, PIDs, red e I/O | CPU % de Docker, bytes y contadores acumulados; no confundir con Node del host |

WEB_VITALS_ENABLED=true habilita captura propia sin Google ni cookies de identificación. Los datos son medición operacional local, no eventos GA4. El hook tiene callback estable. Se guarda la última actualización por ID/nombre y se envía cada cinco segundos si cambió, o al ocultar/salir. El receptor valida lista permitida, Origin, tamaño y límites; los datos del navegador siguen siendo no confiables, sin autoridad sobre pedidos. Límite básico 300 lotes/minuto/proceso. No registra IP ni user-agent. Sin INP observable no se inventa valor cero.

Los CSV consolidan por entorno, experimento, tráfico, ID y nombre, eligiendo la secuencia mayor. Las actualizaciones no se cuentan como muestras independientes. Se agrupa p75 por ruta normalizada, dispositivo y métrica. El dispositivo es una clasificación por ancho de viewport, no una identificación exhaustiva de hardware. Datos recogidos al salir pueden perderse; no hay garantía de entrega.

RESOURCE_METRICS_ENABLED=true habilita muestreo Node/PostgreSQL; RESOURCE_SAMPLE_MS acepta 5000–300000, predeterminado 15000. Una conexión independiente (máximo 1, timeout 2 s) consulta pg_stat_activity. No consulta en cada petición. El monitor del event loop se activa solo en ese modo. Logs stdout JSON; los errores de muestreo se registran sin URL de conexión ni detalles sensibles. No se abre un endpoint público de recursos. [Hook de Next](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals).

## Captura y exportación reproducible

Antes de cada experimento generar un UUID nuevo y mantenerlo igual para app, observador y exportaciones. Registrar APP_ENV, TRAFFIC_KIND, CATALOG_SIZE y EXPERIMENT_CONCURRENCY. Son etiquetas declaradas, no mediciones automáticas ni un generador de carga. Usar `npm run metrics:manifest` para registrar commit, estado de trabajo, Node, plataforma, CPU/memoria disponibles y flags sin secretos; devuelve además un UUID sugerido.

Ejemplo PowerShell, en la terminal de la app:

```powershell
$env:EXPERIMENT_ID = [guid]::NewGuid().ToString()
$env:CATALOG_SIZE = '30'
$env:EXPERIMENT_CONCURRENCY = '1'
$env:TRAFFIC_KIND = 'synthetic'
$env:RESOURCE_METRICS_ENABLED = 'true'
New-Item -ItemType Directory -Force artifacts | Out-Null
# Usar un nombre nuevo; Out-File debe especificar UTF-8 en PowerShell antiguo.
npm start 2>&1 | Out-File -Encoding utf8 artifacts/servidor.jsonl
```

En otra terminal copiar las mismas etiquetas y ejecutar `npm run metrics:docker -- 5` para cinco muestras (intervalo DOCKER_SAMPLE_MS, predeterminado 15000), redirigiendo también con Out-File -Encoding utf8 a otro archivo. Requiere Docker activo y PATH configurado, o DOCKER_BIN explícito. El observador obtiene el contenedor mediante Compose; no altera sus recursos. Sin Docker/privilegios en cloud se documentará la ausencia y se usarán las métricas disponibles del proveedor, sin inventarlas.

Combinar únicamente capturas de la ventana medida y usar:

```powershell
npm run metrics:export -- artifacts/captura.jsonl artifacts/reporte_nuevo 60
```

El tercer argumento es la duración real en segundos de esa ventana, incluyendo tiempos sin solicitudes y excluyendo calentamiento. No se infiere de la distancia entre primera y última petición. Sin duración, throughput queda null. No reutilizar 60 si la captura duró otro tiempo. Exporta summary.json, summary.csv, requests.csv, web-vitals.csv, resources.csv y resources.json. Percentiles empíricos por rango más cercano; los grupos incluyen experimento, tráfico, catálogo, concurrencia, ruta y método. No sobrescribe archivos existentes; dividir entradas de más de un millón de registros. Rechaza capturas sin métricas válidas. CSV protegido frente a fórmulas; bytes normalizados para Docker, sin confundir MB con MiB.

Errores: technical para HTTP >=500, authorization para 401/403, rate_limit para 429 y business para otros 4xx. Los resultados comerciales REJECTED/CANCELLED/UNKNOWN/REVERSAL_PENDING/REVERSED se registran aparte aunque la respuesta sea 200. Reportar también códigos concretos: un 404 o 400 inesperado puede ser un error del experimento, no una condición aceptable. Errores de renderizado se cuentan aparte, sin mezclar con throughput API. No se afirma medir duración HTTP completa de todas las páginas SSR; para experiencia de página usar navegador/Web Vitals y sus fuentes correspondientes.

## Tráfico y comparabilidad

TRAFFIC_KIND se decide por entorno del servidor; no se confía en un header público para clasificar ni elegir propiedad. Si el ID sintético falta o coincide con el humano, GA4 se desactiva para synthetic. Para mediciones simultáneas usar instancias/procesos separados con su propia configuración/base; no clasificar todo un servidor mixto con una sola etiqueta.

Futuros k6 HTTP no ejecutarán gtag ni Web Vitals y no deben fabricar eventos de Google. Una propiedad GA4 de evaluación separada recibirá solo navegadores sintéticos consentidos. Las bases de evaluación y los pedidos deben estar aislados; una marca de reclamación no se restablece entre experimentos. Simulador de pagos obligatorio; Webpay nunca se utiliza para carga.

Comparar builds de producción, mismos flags, intervalo, recursos, versión de código, catálogos y ventana de medición. Registrar diferencias local/cloud y permisos. La instrumentación agrega trabajo y una conexión; no se cuantificó todavía su sobrecosto bajo carga. Las comprobaciones de esta etapa son funcionales, no resultados de capacidad ni escenarios k6.
