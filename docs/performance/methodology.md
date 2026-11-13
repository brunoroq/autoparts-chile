# Metodología prevista de evaluación

Estado al12nov2026: baja, normal y pico HTTP ya ejecutados una vez; ver sus reportes
específicos. La propuesta inicial siguiente no describe mediciones adicionales
ejecutadas. Preparación de30documentos navegador en
[protocolo Core Web Vitals](core-web-vitals-protocol.md), todavía sin ejecución.

Actualización 2026-11-11: scripts locales preparados en [Fase 1.2](phase-1-2.md). Ningún escenario ejecutado. La matriz cloud y el recorrido de compra descritos abajo son objetivos futuros, no autorizaciones de ejecución.

Este documento es un protocolo inicial; no contiene resultados ni umbrales validados. Confirmar valores concretos antes de ejecutar carga.

## Matriz experimental

Evaluar catálogos de 30, 1.000 y 10.000 productos con carga baja, normal sostenida y pico/estrés, localmente y en cloud cuando las condiciones lo permitan. Son hasta 18 combinaciones base antes de repeticiones. Si las cuotas gratuitas limitan la matriz, acordar y documentar un subconjunto sin ocultar omisiones.

Usar semillas deterministas, parámetros de búsqueda con distinta selectividad y distribución documentada de categorías, stock y precios. Registrar filas iniciales y crecimiento de carritos/pedidos. Restaurar o preparar datos entre ejecuciones con un procedimiento aprobado; no truncar datos automáticamente.

## Recorridos

- Navegar por inicio, catálogo y detalle.
- Buscar y filtrar, paginando resultados.
- Añadir al carrito y abandonarlo.
- Iniciar sesión y finalizar una compra simulada.

Definir proporciones de recorridos y pausas realistas antes del ensayo. Usar usuarios de prueba distintos para evitar contención accidental sobre un solo carrito. Comprobar respuestas y resultados de negocio, no solo códigos HTTP.

Parametrizar URL base, usuarios virtuales, ramp-up, duración, tasa de llegada o de solicitudes, tamaño de datos e identificador de ejecución. Distinguir modelos de concurrencia fija y tasa de llegada; no asumir que usuarios y requests/segundo son intercambiables.

## Procedimiento reproducible

1. Registrar commit o estado del código, versiones, infraestructura y configuración no secreta.
2. Confirmar autorización del entorno y límites del proveedor; verificar simulador activo antes de escribir datos.
3. Preparar usuarios y catálogo; verificar funcionalidad y métricas.
4. Ejecutar aplicación con build de producción; separar calentamiento del intervalo medido.
5. Ejecutar escenario y recoger carga, logs, recursos y sesiones de navegador simultáneas.
6. Repetir idealmente al menos tres veces por condición, si las cuotas lo permiten; registrar excepciones.
7. Exportar resultados y analizar dispersión, percentiles, errores y saturación. Cambiar una variable por comparación.

## Métricas y fuentes

| Plano | Métricas | Fuente prevista |
| --- | --- | --- |
| Cliente HTTP | Promedio, mediana, p90/p95/p99, solicitudes/segundo y errores | k6, checks y reportes JSON/resumen; HTML si se configura exportador |
| Aplicación | Estado, duración, ruta, error y correlación de ejecución | Logs estructurados |
| Infraestructura | CPU, memoria, I/O, conexiones y actividad PostgreSQL | Host/contenedores y herramientas disponibles del proveedor |
| Navegador | LCP, INP, CLS y navegación | Web Vitals y muestra de navegadores |
| Analítica | Eventos, engagement y embudo | GA4 de evaluación |

Reportar 4xx y 5xx por separado, indicando fallos intencionales de escenarios negativos. Definir umbrales por operación después de obtener la línea base. El punto de saturación se identifica mediante degradación sostenida de latencia, errores, throughput y/o recursos, con criterio explicitado antes del ensayo.

Los generadores HTTP no ejecutan `gtag.js`. Para observar experiencia bajo carga, usar navegadores paralelos con interacciones suficientes para medir INP. GA4 puede tener demoras de procesamiento; no usarlo como monitor instantáneo. Documentar navegador, red, muestra y duración de sesiones.

## Comparación local y cloud

Registrar para cada ejecución: ubicación del generador, CPU/RAM, sistema operativo, límites de contenedores, versiones, número de instancias, ubicación de app y base de datos, latencia de red, pool de conexiones, TLS/CDN, caché, almacenamiento, cuotas y arranques en frío.

Cuando generador, aplicación y base compartan máquina local, explicitar la competencia por recursos y observar también al generador. Separarlo si limita la prueba. En cloud gratuito, registrar suspensión, throttling y métricas no disponibles. Presentar resultados absolutos de cada entorno y comparaciones con estas limitaciones; no tratarlos como equivalentes.

## Evidencias

Conservar por ejecución: ID, fecha/hora, escenario, parámetros, catálogo, semilla, código, configuración, resultados crudos, resumen y gráficos. Definir ubicación de artefactos y política de versionado cuando existan resultados; evitar subir datos personales, credenciales o grandes logs sin criterio. Registrar conclusiones y decisiones de optimización con evidencia vinculada.
