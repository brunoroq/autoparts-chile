# GA4 exclusivo del laboratorio y navegador observador

## Alcance y estado

Implementación local del 12 de noviembre de 2026. No habilita Analytics en ningún
entorno existente, crea propiedades ni ejecuta escenarios. El ID oficial
`G-VVKYV486NP` queda bloqueado como destino sintético, aunque falte el ID humano.

La carga HTTP de k6 no ejecuta gtag.js. El nuevo modo combina opcionalmente esa
carga con **un navegador observador y un recorrido**. GA4 registra ese navegador,
no los 3/10/30 VU HTTP. En pico son hasta 30 VU HTTP más un observador; no sumar
como una población homogénea. Las tres pruebas anteriores no se reenvían a Google
ni se sobrescriben. Un recorrido no permite conclusiones estadísticas sólidas.

El observador acepta consentimiento en la interfaz; visita catálogo, producto y
carrito; agrega una unidad y la elimina. No registra, autentica, fusiona, inicia
checkout, crea pedidos ni paga. Usa un contexto nuevo y cotización del servidor.
El carrito invitado no reserva ni descuenta stock.

## Activación y seguridad

- Compose deja `PERF_BROWSER_ANALYTICS=false` e ID vacío por defecto. Solo
  `--browser --synthetic-id G-ID_DEL_LAB` activa temporalmente el modo.
- ID válido sintácticamente: G- más 5–20 caracteres alfanuméricos mayúsculos;
  distinto del oficial y del ID humano conocido. Verificar manualmente que
  pertenece a la **propiedad nueva**: el formato no demuestra pertenencia.
- El runner limpia variables Analytics/k6 heredadas. No lee archivos .env de
  producción. El archivo exclusivo del laboratorio sigue ignorado por Git.
- El marcador mantiene las validaciones de base local, proveedor simulado,
  tráfico sintético, UUID y catálogo. Exige doble opt-in para Analytics y devuelve
  `analytics` y `measurementId` públicos. Una imagen antigua falla la salud antes
  de cargar; hay que reconstruirla posteriormente, con autorización.
- `page.route()` verifica rutas, métodos e IDs en query/body/batch antes de
  permitir transporte a Google. Las precargas Next fuera del recorrido reciben
  204 localmente, sin consultar login, checkout u órdenes.
- Proxy obligatorio en loopback: solo 127.0.0.1:3100 y túneles TLS a
  www.googletagmanager.com, www.google-analytics.com y region1.google-analytics.com.
  No descifra TLS ni registra cuerpos/cabeceras/URLs; Chrome verifica certificados.
  Si Google requiere otro host, detener y diagnosticar antes de ampliar permisos.
- Presupuesto navegador: 400 solicitudes, 24 túneles, 32 MiB en el proxy. Se
  reservan 400 del presupuesto HTTP: hasta 9.599 HTTP + 400 navegador + 1 preflight.
  Los túneles no cuentan mensajes HTTP cifrados; page.route controla solicitudes.
- Un observador/una iteración, espera de meseta 30/60/90 s y hasta 90 s de recorrido.
  Se conserva watchdog, observación Docker y mínimo de 2 GiB libres en Windows.
  Chrome consume recursos adicionales en el mismo host.
- El script directo exige plan vigente y proxy. No protege frente a alguien que
  edite deliberadamente código o falsifique planes/flags.
- Al terminar o fallar de forma controlada, se apaga Analytics y se recrea **solo
  app**; no PostgreSQL ni su volumen. Si falla, detener y revisar. Un cierre forzado
  de Windows/proceso puede impedir finally: verificar que ambas variables estén
  apagadas antes de reutilizar el laboratorio. No ejecutar Compose directamente
  con una configuración que haya quedado habilitada.

## Crear y conectar la propiedad posteriormente

1. Crear una propiedad GA4 nueva: `AutoParts Chile — Laboratorio sintético`.
   No editar la propiedad oficial ni su flujo.
2. Crear flujo Web identificado como laboratorio. Usar como referencia
   http://127.0.0.1:3100 si el formulario lo admite; si lo rechaza, revisar ese
   paso antes de continuar. No reutilizar el flujo oficial ni instalar en Vercel.
3. Copiar su ID G-…; no se necesita API secret, Measurement Protocol o contraseña.
4. Revisar medición mejorada de páginas vistas en la propiedad nueva: desactivar
   seguimiento automático de cambios del historial para no duplicar el manual.
   El código usa send_page_view:false. Documentar el ajuste.
5. En Definiciones personalizadas, registrar dimensiones de evento:
   `environment`, `traffic_kind`, `experiment_id`. Esta última tiene alta cardinalidad;
   limitarla a pocas ejecuciones y correlacionar con el manifiesto. No usar PII.
6. Debug permanece false. Verificar primero Realtime; DebugView requiere una
   activación futura exclusiva del laboratorio. Revisar filtros de tráfico interno
   o desarrollador para no excluir el experimento inadvertidamente.
7. Si se autoriza compartir, profesor como Lector también en esta propiedad.

## Comandos preparados: no ejecutados

Sustituir G-ID_DEL_LAB por el ID nuevo (no es secreto). Estos planes son offline:

```powershell
npm run perf -- plan --profile baja --catalog 30 --browser --synthetic-id G-ID_DEL_LAB --observer-only
npm run perf -- plan --profile normal --catalog 30 --browser --synthetic-id G-ID_DEL_LAB
```

Antes de ejecutar: nueva autorización, imagen app reconstruida, laboratorio
saludable, UUID/catálogo confirmados y memoria suficiente. No repetir prepare,
migraciones o seed, ni tocar PostgreSQL habitual o restauraciones. En esta tarea
no se reconstruye ni recrea ningún contenedor.

Futuros comandos, cada uno con autorización independiente:

```powershell
# Referencia: un recorrido de navegador, sin carga HTTP adicional.
npm run perf -- run --run-id UUID_DEL_LAB --profile baja --model closed --catalog 30 --browser --synthetic-id G-ID_DEL_LAB --observer-only --execute
# Observación durante una carga nueva: ejemplo normal.
npm run perf -- run --run-id UUID_DEL_LAB --profile normal --model closed --catalog 30 --browser --synthetic-id G-ID_DEL_LAB --execute
```

No lanzar scripts directos ni dos runners. Lock exclusivo. Salidas nuevas:
`<perfil>-closed-browser` y `<perfil>-closed-browser-baseline`, sin sobrescribir
las tres salidas HTTP originales. Un directorio existente impide repetición
accidental. UUID de experimento nuevo por ejecución.

## Evidencias e interpretación

- manifest.json: configuración, población, recursos, commit y UUID.
- browser/plan.json: ID sintético, plazo y proxy local; sin credenciales.
- browser/summary.json y summary.csv: agregados numéricos k6/browser, incluidos
  Web Vitals cuando se observen. Sin muestras crudas de red con URLs de collect,
  cookies, HAR o identificadores de cliente GA.
- browser/outcome.json: salida, contadores del proxy y resultados saneados de la
  cola de gtag. **Cola correcta no confirma recepción por Google.**
- HTTP y recursos app/Docker permanecen separados. No sumar Google y recursos
  estáticos al throughput del recorrido HTTP.
- Eventos: page_view de catálogo/detalle/carrito, view_item, add_to_cart y
  remove_from_cart. CLP, cantidad 1 y precio de cotización del servidor.
  Sin begin_checkout ni purchase de este recorrido.
- Verificación futura: Network y Realtime de la propiedad nueva, con
  environment=performance-local, traffic_kind=synthetic y experiment_id del
  manifiesto. No presentar estas cifras como visitantes reales o ventas.
- Un solo recorrido no representa distribuciones de engagement, rebote,
  conversión o p99. Comparar referencia/carga en mismas páginas/dispositivo y
  documentar muestras, ventanas, cachés y sobrecosto del generador/interceptación.
- Pendiente ejecución k6/Chrome contra Docker y recepción real en GA4. Las
  pruebas actuales usan componentes reales con Google y cotización simulados,
  sin PostgreSQL, cuentas, compras o tráfico externo. k6 inspect solo inspecciona
  sintaxis/opciones, no inicia Chrome, usuarios, HTTP o escenarios.

## Verificaciones y fuentes

Resultados finales e incidentes documentados en LogFile.txt. Pruebas:
`npm test`, `npm run test:performance`, `npm run test:analytics:browser:local`,
lint, TypeScript, Prisma y build. No equivalen a una simulación real autorizada.

Fuentes oficiales:
[k6/browser](https://grafana.com/docs/k6/latest/javascript-api/k6-browser/),
[interceptación de página](https://grafana.com/docs/k6/latest/javascript-api/k6-browser/page/route/),
[pageviews GA4](https://developers.google.com/analytics/devguides/collection/ga4/views),
[dimensiones de evento](https://support.google.com/analytics/answer/14239696).
