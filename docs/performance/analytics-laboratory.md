# GA4 de laboratorio: contenedor adicional y evidencia HTTP

## Estado actual y alcance

Actualización 2026-11-12. Implementación local, sin crear contenedores ni
reconstruir imágenes en esta etapa y sin tráfico real a Google.

Propiedad de laboratorio informada por el usuario: **G-BLNW54CZ2R**.
Propiedad oficial **G-VVKYV486NP**: prohibida y bloqueada para tráfico sintético.
No se modifican la propiedad oficial, Vercel ni Neon.

La aplicación original sigue en **http://127.0.0.1:3100** y conserva su ID,
imagen, configuración, volumen/red y estado. Compose fuerza Analytics apagado.
El observador utilizará **http://127.0.0.1:3101**, solo loopback; no necesita
parar, renombrar, eliminar, recrear o reemplazar el contenedor original.
Si el puerto 3101 está ocupado, el runner falla sin liberar puertos ni tocar otros servicios.

Este modo admite solo **un observador, una iteración y cero carga HTTP adicional**.
La ruta se activa con --browser --observer-only; profile baja es una etiqueta
requerida por el CLI, no ejecuta el escenario baja. Normal/pico y modo arrival
con observador se rechazan. Los tres perfiles HTTP existentes permanecen aparte,
sin cambios de sus módulos ni resultados anteriores. GA4 observará al navegador,
no a los usuarios virtuales HTTP; son poblaciones distintas.

## Recorrido y controles previos

El recorrido completo es: **inicio → consentimiento → catálogo → producto →
agregar una unidad → carrito → eliminar → carrito vacío**. Se comprueba
JavaScript mediante interacciones/evaluaciones reales y consentimiento granted
leído después de pulsar Aceptar analítica, sin preescribirlo en localStorage.
No hay login, registro, merge, checkout, pedidos, pagos ni reserva de stock.
Los precios y la cantidad se contrastan con la cotización del servidor.

Antes de crear el contenedor, el runner valida:

- Docker Linux y recursos; Windows debe tener al menos 2 GiB libres.
- Original app/PGhealthy, nombres/labels y volumen del UUID del entorno.
- PostgreSQL exclusivo: postgres:5432/autoparts_performance_test, red interna,
  sin puerto host. No se heredan conexiones DATABASE_URL del shell.
- App original con Analytics apagado, IDs vacíos, tráfico synthetic y3100 en loopback.
- Puerto 3101 libre: si no lo está, se detiene sin cambiar la aplicación original.
- Snapshots privados en memoria de todos los contenedores anteriores. Sus IDs,
  imágenes, estado/health, configuración, redes y montajes deben conservarse.
- Lecturas SELECT con default_transaction_read_only=on sobre la base aislada:
  conteos y huellas de nueve tablas. Deben existir 30 productos y 6 categorías y ninguna
  cuenta, carrito, orden o pago. No se guardan filas ni información personal.

## Ciclo del contenedor adicional, solo bajo futura autorización

1. Construir una imagen con tag único observer/UUID, usando Dockerfile.performance.
   La construcción no contiene migraciones o seed. El build usa fixtures, no la BD.
   Setup de build: timeout de 900 s y control de RAM antes/después, separado del ensayo.
2. Crear un contenedor con nombre/labels únicos, env privado, 1 CPU / 1 GiB, pool de 2 conexiones,
   128 PIDs, sin privilegios adicionales, sin montajes o volúmenes y sin restart.
3. Conectarlo a las redes ya existentes; solo el adicional recibe 3101 en loopback.
   PostgreSQL y los otros servicios no se arrancan/reinician/modifican.
4. Verificar healthcheck, puertos efectivos, límite de recursos y marcador
   isolated/observer/origin/UUID/catalogSize/measurementId antes del navegador.
5. Ejecutar un solo k6/browser Chromium en el host contra la app Docker. No se
   instala Chrome en el contenedor ni se afirma haberlo ejecutado allí.
6. Al acabar o fallar: cerrar navegador/proxy y **detener solo el adicional propio**,
   comprobando ID y labels contra la lista protegida. No se borra el contenedor,
   su imagen o un volumen. El original nunca se detiene. El adicional tiene una
   vida máxima independiente de 180 s para no quedar sirviendo si muere el runner.
7. Comparar datos antes/después y verificar originales intactos. Si hay diferencias,
   reportar y detenerse; nunca reparar automáticamente.

El archivo observer.env contiene secretos locales reutilizados solo para esa
aplicación y está bajo artifacts ignorado por Git: **no compartirlo**. El runner
no modifica compose.env ni fuentes ni secretos de producción.

## Límites del recorrido

- Un VU/una iteración, maxDuration de 90 s y watchdog externo de 120 s, sin reintentos.
- Hasta 400 solicitudes; 24 túneles y 32 MiB en proxy. No se generan solicitudes HTTP k6
  de carga; los GETdeaislamiento y el healthcheck son comprobaciones de control.
- RAM libre del host y salud/configuración de contenedores se vigilan cada 5 s;
  CPU/memoria/I/O se muestrean con Docker. Saturación sostenida detiene el ensayo.
- Proxy loopback obligatorio; solo destino local 3101 y tres hosts Google necesarios.
  TLS extremo a extremo, sin desactivar certificados ni descifrar tráfico.
- Page.route valida rutas/métodos, IDs tid/id/send_to y etiquetas del experimento
  en query/body/batch antes del transporte. Bloquea el ID oficial, otros IDs y
  operaciones comerciales. Precargas Next fuera del recorrido reciben 204 local,
  sin visitar checkout/login. No ampliar hosts ante fallos sin diagnóstico.
- El script directo exige plan y proxy válidos. No protege contra manipulación
  deliberada del código. Una sesión nueva acepta el consentimiento por la UI.

## Qué prueba cada evidencia

- **Cola gtag:** prueba emisión de la instrumentación, no transporte.
- **Solicitud pendiente/sin respuesta:** no permite afirmar recepción.
- **HTTP 2xx de Google:** prueba respuesta del transporte del colector; **no** que
  GA4 haya procesado, atribuido o mostrado el evento.
- **Realtime/DebugView:** confirmación posterior dentro de la propiedad del laboratorio.
  Este proyecto no posee acceso automático a esa interfaz ni lo presupone.

El parser solo conserva nombre permitido, ID destino, estado HTTP y etiquetas
verificadas. Omite cid, sid, cookies, tokens, títulos, URL completa y payload
libre. Reconoce GET/POST y batches; 200/204 son éxitoHTTP; 503 o fallos de red no.
first_visit/session_start pueden ser derivados por GA4 de flags del primer evento:
no inventar emisiones explícitas si solo se observaron esos flags.

Se esperan **cuatro page_view**, un view_item, un add_to_cart y un remove_from_cart
si no hay duplicados; el verificador exige esas cantidades para aprobar el caso.
La configuración de medición mejorada debe evitar duplicar el seguimiento manual.
No se generan begin_checkout o purchase. User_engagement/first_visit/session_start
son posibles automáticos, no se fuerzan para completar el informe.

Artefactos nuevos en artifacts/performance/UUID_ENTORNO/browser-observer-UUID/:
manifest.json, container.json, isolation.json, plan.json, summary.json/csv,
browser-outcome.json, outcome.json, resources.json, data-before/after.json y el
**privado** observer.env. No se sobrescriben baja-closed/normal-closed/pico-closed.
Las salidas del navegador son agregadas; no se guardan HAR o muestras de red con
query strings. Fallos incluyen etapa y evidencia saneada disponible.

## Preparación manual GA4 y comando futuro

El usuario ya creó propiedad y dimensiones de ámbito Evento: environment,
experiment_id,traffic_kind. Conservar la propiedad oficial intacta. Verificar
medición mejorada de historial para no duplicar page_view; el código usa
send_page_view:false. GA4_DEBUG permanece false: usar Realtime primero; DebugView
requiere una activación futura exclusiva del laboratorio. Revisar filtros que
pudieran excluir sintéticos; no alterarlos automáticamente. Profesor como Lector
solo si se autoriza compartir esa propiedad.

Plan offline, sin Docker, navegador, Google o escrituras:

~~~powershell
npm run perf -- plan --profile baja --catalog 30 --browser --observer-only --synthetic-id G-BLNW54CZ2R
~~~

**No ejecutar todavía** el siguiente comando. Requiere nueva autorización y
preflight saludable antes de crear el adicional:

~~~powershell
npm run perf -- run --run-id 324a39f2-2164-44cc-8276-5ef9defec5db --profile baja --catalog 30 --model closed --browser --observer-only --synthetic-id G-BLNW54CZ2R --execute
~~~

Luego buscar los eventos en la propiedad G-BLNW54CZ2R y contrastar
traffic_kind=synthetic,environment=performance-local y el experiment_id nuevo del
manifiesto. El UUID del entorno 324a39f2... no es el UUID de experimento.
No presentar una sola observación como una distribución representativa de rebote,
engagement, conversiones o p99. No reenviar resultados históricos a GA4.

## Verificación local y pendientes

Pruebas con componentes reales, transporte Google simulado y Docker ficticio:
inicio/consentimiento/recorrido,7 eventos HTTP 204, rechazo del oficial, aislamiento,
propiedad de contenedor, no detención de originales, batches,503/fallos de red y
sanitización. Lint, TypeScript, Prisma, build y regresiones según LogFile.txt.
No equivalen a validación real de Docker/Chrome/Google. Esa ejecución queda
pendiente de autorización, sin credenciales de GA4 necesarias en código.

Fuentes oficiales: [k6 Page.on](https://grafana.com/docs/k6/latest/javascript-api/k6-browser/page/on/),
[Page.route](https://grafana.com/docs/k6/latest/javascript-api/k6-browser/page/route/),
[pageviews GA4](https://developers.google.com/analytics/devguides/collection/ga4/views).

## Diagnóstico del intento fallido y próximo ensayo

Ver [diagnóstico offline del proxy](browser-proxy-diagnostics.md): hechos e hipótesis
del experimento a59a3235, esquema saneado de etapas/errores y procedimiento para
un único reintento que requiere autorización nueva. No se ampliaron destinos
ni se repitió el ensayo real durante esta mejora.
