# Core Web Vitals: protocolo manual simplificado

Revisión vigente del estudio `7c220427-10d1-4961-acb3-b365371ecfae`, aprobada el
13 de noviembre de 2026. CWV está temporalmente pausado mientras se comparte el
trabajo. No hay métricas CWV confirmadas en este documento.

## Diseño

Tres repeticiones por página y condición: 18 visitas independientes. Primero
nueve baseline sin generador y después nueve durante meseta normal de 10 VU.
La carga normal requiere aprobación separada. Destino local `127.0.0.1:3100`;
Analytics apagado e IDs vacíos. No mezclar con mediciones complementarias de Vercel.

Mantener Chrome 157.0.8103.78 (registrar versión real si cambia), viewport
1440×900, DPR 1, CPU/red sin throttling, caché de navegador desactivada y DevTools
en ventana separada. Sin Computer Use, k6/browser, proxy, calentamiento automático
ni reloj obligatorio para baseline. Comprobar solo accesibilidad, salud local,
telemetría y al menos 2 GiB libres antes de medir.

Las cachés del servidor no se controlan. Los GET previos pueden calentarlas;
registrar orden, pausas y esta limitación. No afirmar servidor frío ni calentamiento
uniforme. La captura de DevTools añade sobrecarga en ambas condiciones.

## Captura por documento

1. Desde `about:blank`, iniciar Performance → Record continuo antes de navegar.
2. Abrir `/`, `/catalogo` o `/productos/kit-de-ampolletas-led-h7`, siempre sobre
   `http://127.0.0.1:3100`. No usar BFCache ni navegación suave entre muestras.
3. Desde aproximadamente el segundo 8, con pausas de 2 s: inicio, tres clics en
   zona no navegable; catálogo, abrir/cerrar/abrir el desplegable de filtros;
   producto, ↑/↓/↑/↓ en cantidad, sin agregar al carrito.
4. Detener alrededor de 25 s y revisar documento completo, LCP, CLS e INP y pista
   Interactions. No confundir tiempo del handler/TBT con INP.
5. Guardar trace original y captura del resumen. Si Chrome exporta `.json.gz`,
   conservar la extensión. No renombrar compresión como JSON ni publicar datos privados.
6. Registrar LCP/INP en ms y CLS sin unidad. Ausencia = `NA`; CLS 0 puede ser válido.
   Una métrica ausente no bloquea las demás visitas; no repetir para seleccionar
   resultados favorables. Registrar errores, controles distintos y observaciones.

No realizar login, compras o modificaciones comerciales. La evidencia de una
interacción no garantiza que INP esté disponible; declarar sus ausencias.

## Archivos y análisis

Cada serie usa `artifacts/cwv/<study>/manual-simplificado-<fecha-hora>/`, nuevo y
sin sobrescribir. CSV UTF-8 con página/ruta, condición, número, inicio/fin con zona,
LCP ms, CLS, INP ms, estado, observaciones, traza y captura. Filas pendientes con
`NA` no son mediciones realizadas. Nombres como `baseline-inicio-01`.

La serie local preparada es `manual-simplificado-20261113-002515`; sus 18 filas
siguen siendo plantilla mientras el operador no confirme capturas reales.
No convertirlas en resultados ni someterlas al CLI anterior de 30 visitas.

Revisar primeras 1–3 evidencias antes de continuar. Para normal, usar una nueva
salida de carga protegida y comprobar que cada visita completa cae dentro de
meseta de 10 VU observados. No reutilizar `normal-closed` histórico ni iniciar
carga en Vercel/Neon. La preparación y autorización de esa ejecución siguen pendientes.

Gráficos de puntos por página/métrica/condición, mediana y número real de muestras,
con `NA` contabilizados aparte. No publicar p99 con tres datos ni concluir cumplimiento
de campo. Las diferencias locales son descriptivas, no capacidad de producción.
