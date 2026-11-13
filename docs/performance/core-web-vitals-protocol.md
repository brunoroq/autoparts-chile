# Protocolo Core Web Vitals: 30 visitas locales

> Protocolo histórico, reemplazado para las siguientes mediciones por el
> [manual simplificado de 18 visitas](core-web-vitals-manual.md). Sus reglas y CLI
> siguen disponibles para reproducir la preparación original, no para bloquear
> o analizar automáticamente la nueva serie manual.

Preparación autorizada por prompt081. **No se han ejecutado visitas ni cargas**.
La investigación k6/browser–GA4 queda pausada. Este protocolo usa Chrome visible
y DevTools manual, con Analyticsfalse e IDs vacíos. No usa observador3101.

## Plan congelado

Estudio preparado offline: `7c220427-10d1-4961-acb3-b365371ecfae`.
Entorno: `324a39f2-2164-44cc-8276-5ef9defec5db`, origen único
`http://127.0.0.1:3100`. Catálogo30, PostgreSQL privado existente.
Archivos ignorados nuevos:

- `artifacts/cwv/<studyId>/study.json`:30UUID de visita, seis corridas y orden.
- `visits.template.json`: plantilla vacía; los null **no son mediciones**.
- `evidence/`: trazas y capturas futuras. No copiar archivos privados a este directorio.

| Bloque | Orden | Visitas por condición | Repeticiones por página |
|---|---|---:|---|
|1|baseline → normal|6+6|1 y2|
|2|normal → baseline|6+6|3 y4|
|3|baseline → normal|3+3|5|

Total: cinco visitas independientes por página y condición,30documentos.
Páginas: `/`, `/catalogo`, `/productos/kit-de-ampolletas-led-h7`.
El slug procede del seed; verificar existencia/stock>=2 en el preflight real,
sin cambiar el catálogo. No sustituir el producto entre condiciones.

Controles: Chrome157.0.8103.78, viewport de contenido1440×900,DPR1,CPU1x,
red sin throttling, caché de navegador desactivada con DevTools abierto y
almacenamiento del sitio limpio antes de cada documento. Sin extensiones,
cuentas abiertas, contraseñas, pestañas adicionales de trabajo o grabación de video.
Dejar enfriar/recuperar recursos entre corridas. No cambiar planes de energía o
versiones durante el estudio. El runner comprueba la versión del archivo Chrome,
sin iniciarlo; si cambió, detenerse y preparar otro estudio, no editar el anterior.

La misma imagen app debe permanecer en las seis corridas; el análisis rechaza
mezclas de imágenes. `serverImage` del manifiesto identifica el build realmente
ejecutado, más fiablemente que atribuir un árbol dirty al SHA base solamente.
Memoria/CPU de app y PostgreSQL permanecen como el laboratorio; no redimensionar.
Chrome y k6 comparten host: esta competencia limita inferencias sobre producción.

## Qué está preparado y qué todavía requiere autorización

`npm run cwv -- plan ...` es offline: genera solo plan/plantillas, sin navegador,
Docker o HTTP. Ya se ejecutó una vez para el estudio anterior. Otros UUID impresos
por tests corresponden a fixtures en tmp, nunca a experimentos reales.

`perf baseline/run --measurement-id ... --study-id ... --execute` **no está
autorizado ahora**. En una autorización posterior:

1. Preflight completo: DockerLinux local, memoriaWindows>=2GiB, servicioshealthy,
   noOOM/reinicios, puertosloopback3100,PGsinpublicar/redinterna/volumenexacto,
   APP_ENVperformance-local,TRAFFIC_KINDsynthetic,BDlocal y DIRECTcoherente,
   Analyticsfalse/IDs vacíos. Overrides DOCKER_HOST/DOCKER_CONTEXT bloqueados.
2. El comando valida pertenencia del run al estudio/condición y asigna una carpeta
   nueva `artifacts/performance/<environment>/measurements/<runId>/`. EEXIST
   detiene antes de cambiar configuración; no borra ni reutiliza normal-closed.
3. Configura únicamente la app local: EXPERIMENT_ID nuevo y WEB_VITALS_ENABLEDtrue.
   Puede recrear **solo app** para aplicar variables; nunca PG ni su volumen.
   GA4 y ambos IDs permanecen apagados/vacíos por Compose. No hace build, seed,
   migraciones o modificaciones comerciales. Verifica misma imagen y variables
   efectivas antes de medir. Se comparan huellas SELECT de nueve tablas al cierre.
4. Calienta secuencialmente las tres páginas y sus variantes optimizadas de imagen
   encontradas en HTML: solo GETloopback, sin JS. Topes99requests/64MiB, tiempos15s
   por recurso, sin redirecciones y rutas de imagen públicas. Un error detiene.
   Esto no es carga concurrente ni visita de navegador. Se guarda warmup.json.
   No se vacían cachés del servidor; se aplica el mismo calentamiento a ambas condiciones.
5. baseline: no inicia k6, solo un relojNode inerte300s y los monitores. normal:
   k6HTTP normal/closed10VU,60s rampa+300smeseta+60sbajada. Un navegador adicional
   manual; **no significa11usuarios reales**. No se ejecutan baja/pico.
6. Watchdog330sbaseline/450snormal, memoria>=2GiB, salud cada6s, muestreo de recursos
   y umbrales existentes de saturación/error. SIGINT/SIGTERM termina únicamente
   procesos hijos propios. No detener PG ni reparar datos si falla.

El presupuesto10000 es del generador por corrida normal, no de todos los recursos
de navegador y calentamiento juntos. Estos últimos se registran aparte. La captura
añade overhead, igual en ambas condiciones. No comparar con producción/CrUX.

## Comandos futuros, uno por vez y solo después de aprobación

Desde el worktree autorizado, cargar **solo metadatos públicos**:

~~~powershell
$study = Get-Content 'artifacts/cwv/7c220427-10d1-4961-acb3-b365371ecfae/study.json' -Raw | ConvertFrom-Json
$block = $study.blocks[0]
# NO ejecutar ahora:
npm run perf -- baseline --run-id $study.environmentId --profile normal --catalog 30 --model closed --measurement-id $block.baselineRunId --study-id $study.studyId --execute
# Después de completar baseline y comprobar su cierre:
npm run perf -- run --run-id $study.environmentId --profile normal --catalog 30 --model closed --measurement-id $block.normalRunId --study-id $study.studyId --execute
~~~

Bloque2 utiliza **primero normal** y luego baseline; bloque3 vuelve a baseline/normal.
No usar un bucle que lance seis corridas sin revisar cada cierre. Sin reintentos
automáticos; una corrida interrumpida mantiene sus UUID/artefactos y no se recicla.
Los tiempos fijos suman36min de captura (3×300+3×420), más arranque, calentamiento,
revisión y pausas; no es una estimación de duración real ya medida.

## Sincronización y visita independiente

No usar la hora de spawn como comienzo de meseta. El VU1 emite una sola marca
`cwv_scenario_clock` con `exec.scenario.startTime`; el runner extrae solo ese JSON
y publica/guarda `cwv-window.json` con ventana real60–360s del escenario.
baseline usa reloj del host y ventana300s. Ambos descartan los primeros y últimos15s.

Dentro de la ventana útil270s caben seis slots de35s (visita prevista25s, máximo30s).
Consultar en study.json las páginas/UUID/slots de esa corrida. No iniciar visitas
durante arranque, recreación o rampa. La primera visita debe servir de control
dentro de las30: si faltan INP, evidencias o control de aislamiento, detener el
procedimiento antes de continuar. No añadir interacciones aleatorias o repetirla
para forzar una muestra favorable.

Para cada visita:

1. Nuevo documento, sin BFCache ni navegación suave. Limpiar almacenamiento y
   mantener Disable cache, viewport,DPR,red,CPU exactos. Registrar controles reales;
   la plantilla propone valores, no los certifica. Pegar URL local exacta.
2. Iniciar grabación **manual continua** de DevTools Performance antes de navegar;
   no usar el modo que se detiene automáticamente al terminar la carga. Dejar
   desactivada la consulta de datos de campo/CrUX durante la prueba local.
3. Registrar `performance.timeOrigin` del documento como timeOriginMs/startedAt
   en UTCISO; no usar la hora de pegar el enlace en la barra. A los8s comenzar:
   - inicio:3Tab con pausas de2s, foco inicial consistente en documento;
   - catálogo:3clicks reales sobre el summary de filtros, pausas de2s;
   - producto:ArrowUp/ArrowDown/ArrowUp/ArrowDown en cantidad, pausas de2s.
   No clickear agregar, login, checkout o enlaces de pedido.
4. Mantener página visible/activa. Si no aparece una interacción medible en INP,
   registrar null y detenerse. Tab es un candidato de interacción, no una garantía
   de que la versión/hardware produzca INP observable: falta validarlo en real.
5. Alrededor de25s, sin más interacciones de la página, capturar valores de DevTools,
   finalizar/ocultar el documento para flush de WebVitals y detener la grabación.
   Registrar endedAt real; duración aceptable20–30s. No provocar navegación adicional
   dentro del período medido. Guardar métricas/captura coherentes con esa grabación.
6. Guardar `evidence/<visitId>.trace.json` y `<visitId>.png` en el estudio. Revisar
   trace/captura para comprobar origen,interacciones y valores; no son HAR públicos.
   No incluir cookies/tokens/usuarios ni exportar perfiles personales.
7. Completar una copia `visits.json` de la plantilla con datos realmente observados:
   LCP/INP enms (convertir segundos×1000 si UI los muestra así),CLSscore, Chrome,
   foreground/finalized, interacciones3/3/4 y consoleErrors/httpErrors0comprobados.
   Mantener null si falta un dato; nunca rellenar con valores de fixtures o del ejemplo.

Para copiar únicamente metadatos reales desde Console de DevTools al final de
cada documento (no ejecutarlo ahora):

~~~javascript
copy(JSON.stringify({
  observedUrl: location.origin + location.pathname,
  timeOriginMs: performance.timeOrigin,
  startedAt: new Date(performance.timeOrigin).toISOString(),
  endedAt: new Date().toISOString()
}));
~~~

No es un generador de métricas ni un envío. No copiar cookies, storage, cabeceras
o URLs con parámetros. Las tres métricas y controles se obtienen/verifican en
DevTools y contra la evidencia guardada; no se deducen del tiempo de permanencia.

La captura propia Next es secundaria y consolida sus actualizaciones por ID/nombre.
Los datos primarios de este estudio son documentos DevTools de25s; no todas las
actualizaciones de métricas ni sesiones GA4. Su alcance no equivale a la vida completa
de una sesión real, y los gestos fijados no representan todo comportamiento posible.

## Validación, exclusión y exportación

Tras cada corrida comprobar outcome sin errores, salud y data-after. Detenerse
si falla; sin reposición de stock o reintentos. Una vez recogidos los documentos:

~~~powershell
npm run cwv -- analyze --study-id 7c220427-10d1-4961-acb3-b365371ecfae --input visits.json
~~~

Este análisis es offline, no envía datos ni abre navegadores. Verifica30IDs planeados,
fuentes/controles, evidencia con ruta acotada, hashes de archivos y corridas válidas
del mismo estudio/Chrome/imagen, integridad intacta y GA4false. No acepta registros
duplicados/extra ni rutas de credenciales. Excluye:

- Documento/trace reutilizado, datos faltantes, INPausente o controles distintos.
- Destino incorrecto, errores de navegador/HTTP o falta de finalización/visibilidad.
- Duración fuera de20–30s o visita que cruza los márgenes de la ventana.
- Normal sin cobertura de `vus=10`: se requiere muestra antes/después, todos los
  valores10 y sin huecos mayores2,5s en k6.jsonl. No se infiere desde maxVus configurado.
- Corrida abortada, integridad no confirmada o imagen/Chrome cambiados.

Cada intento permanece visible con razones; no borrarlo ni contar ausente como cero.
Se exporta a carpeta nueva analysis-UUID:visits.json/csv,summary.json/csv,deltas.csv
ycoverage.json. Incluye SHA256 de trace/captura, nplaneado/aceptado ycompletefalse
si falta alguna de30. La revisión física de traces/valores sigue siendo humana;
el analizador no demuestra por sí solo que los números provengan de Chrome.

## Gráficos e interpretación

Abrir CSV en una herramienta estándar de gráficos/hoja de cálculo:

1. Gráfico de puntos por página y métrica: cinco valores de baseline junto a cinco
   de normal; usar accepted=true y mostrar n. LCP/INPms,CLSscore en ejes separados.
2. Añadir mediana y p75. Mediana convencional (promedio de centrales si npar),
   p75 por rango cercanoceil(0,75×n). No promediar percentiles de corridas ni publicar
   p99 con cinco documentos.
3. Tabla de diferencias de mediana, absolutas y porcentuales; si baseline0, porcentaje
   no definido (null), nunca infinito. Mostrar también faltantes y exclusiones.
4. Correlacionar la ventana con VU,latenciasHTTP,CPU,RAM/PG disponibles en cada corrida;
   no mezclar todo el perfil con las ventanas de estas visitas.

No convertirlo en rebote,engagement,conversión o datos GA4. No certificar cumplimiento
de campo con n5; las conclusiones son descriptivas del laboratorio. Los tres ensayos
HTTP históricos permanecen separados y no se repiten para reemplazar sus resultados.

## Validación offline y límites pendientes

Pruebas de matriz/IDs, clockfragmentado, exclusiones,10VU,mediana/p75, aislamiento,
calentamiento con fetch simulado,huellasSELECTsimuladas,salidasnooverwrite y workflow
con30fixtures en tmp. No se lanzan Chrome/k6/Docker ni Google. El test de navegador
existente se excluye expresamente de la regresión de esta etapa. Ver LogFile.txt.

Pendiente real: salud/recursos actuales,aplicación de variables solo en app local,
versiónChrome no cambiada,existencia del producto,reloj real/gauges del escenario,
INPobservable con gestos propuestos y capturasfinales correctas. No afirmar que el
protocolo pasó en hardware solo porque pasaron fixtures. Solicitar autorización
antes de configurar/capturar la primera corrida y continuar bloque a bloque.
