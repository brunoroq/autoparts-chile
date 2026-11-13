# Diagnóstico offline del observador GA4

Actualización prompt079: ver [investigación de Chromium](chromium-startup-research.md).
La consulta horaria tiene un control específico, pero k6v2.3.0 no permite pasar
su lista completa de features por K6_BROWSER_ARGS sin fragmentarla. El candidato
que sustituía defaults se descartó; no se modificó el arranque ejecutable y no
se recomienda otro intento idéntico sin resolver esa limitación.

## Evidencia del intento anterior

Experimento `a59a3235-7a25-43a6-8da7-d191b1eea889`, 12 de noviembre de 2026.
Se revisaron los JSON existentes y el cierre del prompt072 en LogFile.txt sin
alterarlos. El adicional arrancó saludable y su marcador confirmó catálogo30,
aislamiento, origen3101 e ID `G-BLNW54CZ2R`. El runner llegó a
`single-browser-journey`; posteriormente se encontró un proceso Chrome propio,
que se cerró en aquella ejecución. Esto acredita arranque del proceso, no que
BrowserContext, página, consentimiento o JavaScript hayan quedado listos.

El proxy registró una solicitud HTTP, cero intentos CONNECT, cero bytes y un
`blocked`. El código anterior incrementaba `blocked` tanto para política como
para errores de forwarding; por eso **la causa exacta no puede recuperarse**.
No hay resumen k6 ni resultado del recorrido, ni evento con respuesta Google.
La preparación correcta no prueba envío ni ingestión en GA4.

Los contadores y el tiempo registrado no muestran agotamiento de los límites;
la muestra de memoria superó2GiB. Son hipótesis pendientes: una solicitud
auxiliar de Chrome rechazada o un fallo de conexión/forwarding local. No se
atribuye el fallo a una URL concreta, a GA4, al consentimiento o a la aplicación.
La verificación anterior de las nueve tablas confirmó huellas iguales, y los
contenedores originales y resultados históricos quedaron intactos.

## Instrumentación nueva

`BrowserDiagnostics` comparte esquema cerrado entre Node y k6: código, fase,
categoría de destino, método, contador, errno permitido y estado HTTP numérico.
No persiste mensajes de error originales, URL, IP, cabeceras, cuerpos, cookies,
credenciales, cid, sid ni títulos. Hasta256 registros, reservando lugar para la
primera causa fatal; los descartados se contabilizan. Los errores posteriores
de cierre no reemplazan esa causa. El ID solo se incluye si coincide con el
ID sintético esperado. El experiment_id proviene del manifiesto nuevo.

Cada ejecución futura tendrá `diagnostics.jsonl` y `diagnostics.json` en su
carpeta nueva e ignorada de artefactos. El primer archivo se escribe antes de
activar la parada; el segundo conserva la primera causa y descartes al cerrar.
stdout/stderr de k6 se interpretan en memoria, con fragmentación acotada y
sanitización por lista permitida; nunca se guardan íntegros. Las pruebas actuales
no generan otro experimento ni reescriben evidencia anterior.

| Evidencia nueva | Interpretación y límite |
|---|---|
| K6_SPAWN_REQUESTED / K6_SPAWN_ERROR / K6_PROCESS_CLOSED | Lanzamiento, errno permitido, salida y señal; no prueba página lista |
| BROWSER_LAUNCH_REQUESTED / BROWSER_CONTEXT_READY / BROWSER_PAGE_READY | Fronteras de inicialización; los errores del runtime previo se clasifican aparte |
| LOCAL_NAVIGATION_STARTED / LOCAL_HTTP_RESPONSE | Inicio y respuesta local categorizada, sin rutas libres |
| CONSENT_ACTION_REQUESTED / CONSENT_GRANTED | Click solicitado y valor de consentimiento comprobado en memoria |
| GTAG_SCRIPT_REQUESTED / GTAG_SCRIPT_HTTP / GTAG_SCRIPT_FAILED | Solicitud, respuesta o fallo de script; HTTP200 por sí solo no prueba ejecución |
| GTAG_QUEUE_READY | La aplicación encoló page_view; no equivale a entrega |
| PROXY_CONNECT_REQUEST / PROXY_TUNNEL_ESTABLISHED | CONNECT solicitado y TCP establecido; el proxy no descifra TLS |
| BROWSER_CERTIFICATE_ERROR / BROWSER_PROXY_ERROR / BROWSER_DNS_ERROR | Clasificación del error del navegador, sin guardar texto original |
| ANALYTICS_REQUEST / ANALYTICS_HTTP_RESPONSE / ANALYTICS_REQUEST_FAILED | Evento permitido, ID esperado y estado HTTP; no confirma recepción en informes GA4 |
| PROXY_POLICY_BLOCKED / PROXY_LOCAL_CONNECT_ERROR / PROXY_LOCAL_TIMEOUT | Diferencia rechazo de política, forwarding y timeout |
| PROXY_LIMIT_STOP / WATCHDOG_STOP / RESOURCE_STOP | Presupuesto, plazo o salud/recursos; parada sin reintento |

`blocked` conserva su significado histórico de paradas, incluso de transporte;
`policyBlocks`, `transportErrors`, `established` y la primera causa lo desambiguan.
Un túnel establecido solo prueba TCP, nunca aceptación TLS o ingestión Google.

## Política de red conservada

- HTTP: solo rutas de lectura y cotización invitada permitidas de
  `http://127.0.0.1:3101`, sin cuentas, checkout, pedidos, pagos o escrituras de stock.
- HTTPS: solo `www.googletagmanager.com` (`GET /gtag/js`, `/gtag/destination`),
  `www.google-analytics.com` y `region1.google-analytics.com` (`GET/POST /g/collect`).
- La interceptación obligatoria del navegador valida ID en query, body y batches
  y las etiquetas del envío. `G-VVKYV486NP`, IDs distintos del configurado,
  IDs ausentes, protocolos/puertos/hosts ajenos permanecen bloqueados.
- El proxy CONNECT limita hosts/443. No puede inspeccionar el ID cifrado; esa
  validación se realiza antes del transporte en la ruta del navegador. No se
  desactivan certificados ni se autoriza un destino por estar en un mensaje de error.
- Las precargas descartadas solo reciben204 si son locales; una cabecera
  `next-router-prefetch` no evita el rechazo de destinos externos.
- Una eventual conexión auxiliar de Chrome continúa bloqueada y detiene el ensayo.
  `chrome_auxiliary` es una categoría diagnóstica, no una excepción de red.

## Verificaciones offline

Pruebas con transporte HTTP/TCP sustituido, sin resolver hosts ni contactar
Google/3101: respuesta200, ECONNREFUSED, timeout, DNS simulado, límites fijos,
destinos/IDs bloqueados, privacidad, fragmentación y preservación de primera causa.
El recorrido compartido usa componentes React reales y Google simulado; comprueba
consentimiento, cola y respuestas de eventos. Validación lint/TypeScript/Prisma,
unitarias y compilación registradas en LogFile.txt. No se invocó Docker, SQL ni
`k6 run`; no se generó tráfico real ni se inspeccionó la salud actual de servicios.

## Un único reintento futuro, todavía no autorizado

### Compatibilidad del marcador original (prompt075)

El preflight del prompt074 se detuvo antes de ejecutar k6: exigía `analytics=false`
en el marcador de la imagen original, que solo devuelve `isolated`, `runId` y
`catalogSize`. La ausencia del campo no demuestra Analytics activado.

`scripts/performance-observer-marker.js` valida el contrato antiguo con UUID y
catálogo esperados, `isolated=true` y tipos correctos. Exige de forma independiente
que `Config.Env` del original tenga `ANALYTICS_ENABLED=false` y ambos IDs de
medición vacíos o ausentes. Si un marcador nuevo trae campos adicionales de
Analytics, observador u origen, rechaza valores contradictorios.

El preflight auxiliar `tmp/observer-074-preflight.cjs` utiliza esa función; crea
una carpeta de evidencia con UUID nuevo, sin sobrescribir la del fallo074.
Es un auxiliar ignorado por Git, no un comando de ejecución aprobado ahora.
No se ejecutó contra Docker durante esta corrección.

Esta compatibilidad **no se aplica al temporal3101**: el runner conserva la
exigencia de `analytics=true`, `observer=true`, origen3101, experiment_id nuevo,
catálogo30 e ID sintético esperado `G-BLNW54CZ2R`. El ID oficial permanece
bloqueado. Cuatro pruebas nuevas cubren aceptación antigua, rechazo de marcadores
inválidos, Analytics/IDs indebidos y separación de la validación temporal.

Antes de un ensayo real se debe volver a completar todo el preflight, incluidas
salud, memoria, versiónk6, huellas de datos y diagnósticos. La aprobación de esta
corrección offline no autoriza operar contenedores ni ejecutar el recorrido.

1. Obtener autorización explícita para una iteración, eventos Google de laboratorio
   y creación/limpieza de los recursos temporales propios. No reutilizar el UUID fallido.
2. Repetir preflight: Docker, memoria Windows>=2GiB, salud e identidad de originales,
   PostgreSQL privado, huella SELECT de nueve tablas y marcador3100 del UUID de
   entorno `324a39f2-2164-44cc-8276-5ef9defec5db`;3101 libre. Original Analyticsfalse.
   Registrar huellas de resultados previos. Detenerse ante cualquier diferencia.
3. Revisar plan offline y configuración del adicional: solo3101loopback, sin cambiar
   originales ni puertos PostgreSQL, IDúnico `G-BLNW54CZ2R`, etiquetas sintéticas.
   El runner genera experiment_id nuevo distinto del UUID de entorno.
4. Ejecutar **una sola vez**, tras aprobación, el comando protegido:

~~~powershell
npm run perf -- run --run-id 324a39f2-2164-44cc-8276-5ef9defec5db --profile baja --catalog 30 --model closed --browser --observer-only --synthetic-id G-BLNW54CZ2R --execute
~~~

5. Un navegador, una iteración, sin carga HTTP adicional: inicio, consentimiento,
   catálogo, producto, una unidad invitada y eliminación. Máximo90s, watchdog120s,
   400solicitudes,24CONNECT y32MiB. No cuentas, compras o pagos. Vigilar recursos.
   Detener al primer bloqueo/error; no permitir nuevos hosts ni repetir eventos.
6. Guardar diagnósticos saneados aun si falla. Diferenciar cola, respuesta HTTP e
   interfaz GA4. Esperado:4page_view,1view_item,1add_to_cart,1remove_from_cart.
   Una respuesta2xx no confirma ingestión; comprobar Realtime por experiment_id,
   environment=performance-local y traffic_kind=synthetic en la propiedad laboratorio.
7. Verificar originales y huellas; cerrar únicamente procesos, proxy, contenedor,
   etiqueta temporal y archivo privado de ese experimento. No volúmenes/global prune.
   El runner detiene su contenedor: la eliminación del adicional/etiqueta/archivo y
   comprobación de Chrome remanente requieren la limpieza acotada del procedimiento.
   No borrar evidencia ni resultados históricos. Si queda algún recurso no confirmado,
   informar antes de intervenir. No reintentar automáticamente.

Riesgos pendientes: compatibilidad efectiva de Chrome/k6 en el ensayo real,
solicitudes auxiliares aún desconocidas, conectividad/certificados, pérdida de
eventos durante cierre abrupto y demoras/filtros de GA4. Se mejora observabilidad;
no se afirma haber reparado la causa original ni garantizado recepción real.
