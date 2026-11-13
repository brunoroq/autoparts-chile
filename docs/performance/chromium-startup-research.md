# Investigación offline del arranque Chromium

Fecha: 12 de noviembre de 2026. Prompt079. No se ejecutó k6/browser ni Chromium,
Docker, SQL o solicitudes Analytics. La consulta de documentación pública es
investigación de fuentes; las verificaciones ejecutables fueron offline.

## Hechos y causa probable

En `a85db59c-8db2-4a00-be53-ea658d0b3d38`, la primera parada fue
`PROXY_POLICY_BLOCKED / chrome_auxiliary / REMOTE_HTTP_BLOCKED`, durante
`browser_launch`. El clasificador reconoce la familia de consultas horarias de
Chromium. Después se rechazó un CONNECT externo no identificado. Ningún túnel
quedó establecido; cero bytes, ningún contexto/página/consentimiento o evento
Google confirmado. No se añaden datos nuevos a aquellas evidencias históricas.

La explicación probable del primer intento externo es el servicio horario:
Chromium define `NetworkTimeServiceQuerying` y condiciona las consultas a esa
feature. Su código permite estados sin sincronización exitosa. Esto no demuestra
que un rechazo horario impida a Chrome navegar. En nuestro caso, **el runner
detuvo k6 deliberadamente**: `browserProxy.fail()` registra el fallo y llama a
`stop()`, cuyo callback marca error y mata el proceso. Se mantiene esa política.
No es posible atribuir el CONNECT secundario a cuentas, actualizaciones u otro
servicio concreto con la categoría disponible.

El código de [NetworkTimeTracker](https://raw.githubusercontent.com/chromium/chromium/main/components/network_time/network_time_tracker.cc)
define la feature en líneas68–74, el destino horario en146 y el control de
habilitación en429–431. El código oficial de
[Playwright](https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright-core/src/server/chromium/chromiumSwitches.ts)
también la desactiva expresamente para evitar consultas al arrancar; trata aparte
optimización, elegibilidad de búsqueda y preconexiones. Son mecanismos posibles,
no pruebas del origen de nuestra segunda solicitud.

## Compatibilidad y opciones evaluadas

El laboratorio verificó previamente k6v2.3.0. En esta investigación se leyó la
versión del archivo Chrome instalado:157.0.8103.78, sin iniciarlo. Se buscaron
nombres en chrome.dll mediante lectura por bloques: están presentes
NetworkTimeServiceQuerying y los switches de la tabla siguiente. La presencia
de cadenas acredita nombres compilados, **no su eficacia en una ejecución**.
Registro ignorado: `tmp/chromium-offline-079/binary-symbols.json`.

| Opción | Evaluación offline | Aplicación |
|---|---|---|
| disable-background-networking | k6 ya la incluye por defecto; no cubre necesariamente el servicio horario | Conservar |
| disable-breakpad, metrics-recording-only, disable-extensions, no-first-run | Ya forman parte del arranque automatizado de k6 | Conservar |
| disable-component-update, disable-sync, disable-domain-reliability, no-pings | Reducen servicios auxiliares según documentación oficial; no eliminan de manera demostrada la causa horaria | No agregadas aisladamente |
| disable-features=NetworkTimeServiceQuerying | Control específico, pero reemplaza la lista default de k6 | Candidato descartado |
| OptimizationHints, AimEnabled, PreconnectToSearch | Posibles fuentes documentadas de tráfico adicional; no identificadas en nuestro CONNECT | No modificar por conjetura |
| Precarga de páginas, DNS y renderizado | Cambiar indiscriminadamente su comportamiento sesgaría mediciones; el proxy conserva el tratamiento de prefetch local | Sin cambios |
| ignore-certificate-errors, insecureSkipTLSVerify, no-sandbox, disable-web-security | No son una solución aceptable | No introducir |

Las opciones auxiliares están descritas en la guía de
[GoogleChrome/chrome-launcher](https://github.com/GoogleChrome/chrome-launcher/blob/main/docs/chrome-flags-for-tools.md).
No se cambió Safe Browsing, validación de certificados, configuración del sistema
o política de red. El bloqueo del IDoficial y del tráfico fuera de la lista sigue
vigente; el IDesperado del ensayo sigue siendo G-BLNW54CZ2R.

## Impedimento concreto de k6v2.3.0

El parser [browser_options.go](https://raw.githubusercontent.com/grafana/k6/v2.3.0/internal/js/modules/k6/browser/common/browser_options.go)
líneas142–151 divide K6_BROWSER_ARGS con `strings.Split(v, ",")`, antes de
procesar comillas. [browser_type.go](https://raw.githubusercontent.com/grafana/k6/v2.3.0/internal/js/modules/k6/browser/chromium/browser_type.go)
líneas405–468 configura defaults y asigna después cada argumento por nombre;
la última asignación sustituye el valor anterior.

Una lista `disable-features="A,B"` se fragmenta; repetir el argumento tampoco
concatena. Una sola feature sí llega correctamente, pero sustituye los defaults:
ImprovedCookieControls, LazyFrameLoading, GlobalMediaControls,
DestroyProfileOnBrowserClose, MediaRouter y AcceptCHFrame. No se acepta reactivar
inadvertidamente esos comportamientos, especialmente descubrimiento multimedia,
como precio de suprimir la consulta horaria. No se afirma que todos esos defaults
sigan activos como features en la versión actual de Chrome.

Se preparó un candidato con flags cerradas y guardas de entorno, pero se retiró
durante la investigación al comprobar esa sustitución; **no quedó cambio de
arranque ejecutable**. Su validación también detectó un error de tipado del entorno
del proceso; el candidato fue retirado, no publicado ni ejecutado. Las pruebas
finales corresponden al estado conservado, no a ese candidato.

## Resultado y decisión

Se añadieron tres reproducciones unitarias sin navegador: fragmentación de una
lista entrecomillada, sustitución al repetir flags y conservación de proxy/bloqueos.
El modelo replica esas funciones Go publicadas: no pretende ejecutar ni probar
el binario Go real. La regresión offline excluye expresamente el test que inicia
Chrome mediante Playwright. Resultados finales y build en LogFile.txt.

No se amplían dominios, no se ignoran rechazos auxiliares, no se alteran certificados,
contenedores o bases. SHA256 inicial/final de las cinco carpetas históricas se
compara sin escribirlas. Investigación y evidencia nuevas solo en docs/tests/tmp.

**No hay justificación suficiente para repetir ahora la misma prueba real**:
el servicio identificado sigue habilitado y el CONNECT secundario es desconocido.
La siguiente propuesta técnica sería evaluar un lanzador administrado que pase
un argv real a Chromium, conserve íntegros los defaults y agregue las features
necesarias; k6 podría conectarse por CDP local. Cambia el ciclo de vida y exigiría
gestión de PID/perfil, límites, watchdog, saneamiento y limpieza propios. No está
implementado ni validado y requiere autorización adicional; no es un workaround
que deba ejecutarse automáticamente. También se puede investigar una versión de
k6 cuyo parser soporte listas, sin actualizar ni parchear herramientas ahora.

Hasta resolver y validar esa configuración, detenerse. La autorización offline
actual no autoriza ensayo real, instalaciones, procesos Chromium o conexiones GA4.
