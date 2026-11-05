# Verificación de preparación Vercel/Neon

Fecha: 5 de noviembre de 2026, America/Santiago. Preparación autorizada por prompt 015. Base Git b4fd000 (etapa 4); implementación de etapa 5 pendiente de commit. No se crearon commits ni se cambió el índice Git. Sin push, despliegue, carga, creación de Neon ni ejecución de migraciones/bootstrap remotos.

## Cambios

Node 24.x y npm 11 existentes; lockfile sin actualización de dependencias. Cliente Prisma reutilizado en producción, configuración de pool pequeña para Vercel y TLS verificado. Conexión DIRECT_URL administrativa separada, con fallback local intacto. Runtime Node explícito en layout y todos los Route Handlers. Guardas de arranque para HTTPS canónico, Neon pooled y secreto válido. Vercel solo permite pagos simulados y bloquea el adaptador Webpay. Muestreo periódico bloqueado tanto en instrumentation como en el sampler al detectar VERCEL=1.

Scripts cloud con archivo privado exclusivo, confirmación exacta de destino, TLS y simulación por defecto. No se usa .env local como destino cloud. Bootstrap de seis categorías/30 productos con validación de identidad y solo inserciones, nunca actualización de stock/precios/usuarios/pedidos. Ver [procedimiento y configuración](deployment-vercel-neon.md).

## Aislamiento y conservación de datos

Se tomó una huella READ ONLY/RepeatableRead de las ocho tablas de la tienda habitual y _prisma_migrations. Guarda solo conteos y hashes, sin filas ni credenciales, en tmp/deployment-local-before.json. La comprobación posterior coincidió exactamente. No se ejecutaron migraciones, seed ni operaciones comerciales sobre la base habitual. Docker estaba apagado al inicio; se inició conservando su volumen.

Para las pruebas se crearon seis bases nuevas: autoparts_deploy_base_test, autoparts_deploy_auth_test, autoparts_deploy_checkout_test, autoparts_deploy_analytics_test, autoparts_deploy_catalog_test y autoparts_deploy_bootstrap_test. Las migraciones ejecutadas fueron exclusivamente en esas bases locales nuevas. El runner también sustituye DATABASE_URL por la copia base al ejecutar regresión, para impedir que un cliente sin parámetro explícito use la tienda habitual. Las bases de pruebas de etapas anteriores tampoco se limpiaron ni reutilizaron.

## Pruebas realizadas

- Validación de destinos: localhost, sufijos engañosos, puerto incorrecto, pooler administrativo, TLS desactivado, parámetros ambiguos/duplicados y destino no coincidente se rechazan antes de conexión/escritura. Los tests reemplazan connect por un mock: simulación de migrate y bootstrap hizo cero conexiones.
- Pool: defaults 2 conexiones Vercel/5 local, límites y tiempos validados. Arranque rechaza configuraciones cloud inseguras.
- Vercel con monitor activado por error: no se crea ningún timer. Webpay bloqueado aun cuando se intente construir el adaptador.
- Bootstrap real local: dos ejecuciones concurrentes insertan una sola copia del catálogo; repetición inserta cero productos. Precio 111 CLP, stock 0, producto desactivado y nombre editado se preservan. Se conservan productos ajenos, usuario, carrito, pedido, líneas y pago completos. Conflicto de identidad falla sin cambios parciales.
- Integración PostgreSQL: 14 casos exitosos incluyendo bootstrap, reclamación GA4, catálogo/seed hasta 10.000, registro/carrito y compras/concurrencia/reversas.
- HTTP: 8 casos exitosos, sobre servidores con las bases nuevas. Incluye autenticación, CSRF, autorización, carrito, checkout, catálogo y contratos de error.
- Chrome: 18 recorridos exitosos (41,9 s), escritorio y móvil. Registro/login/logout, persistencia, conflictos, catálogo, compra simulada, consentimiento, eventos CLP, bloqueo de Google y deduplicación. Google interceptado; no se enviaron eventos reales.
- Reinicio real de checkout y observabilidad/exportación: exitosos en las bases nuevas. Exportación funcional: 11 registros/una métrica CLS consolidada en tmp/observability-gGVAAr/export; no es una medición de capacidad.
- Lint, TypeScript, validación Prisma y build exitosos durante la preparación. Sin funciones Edge en el manifiesto de build. Auditoría de producción: cero vulnerabilidades.

Se añadió además una comprobación de error de URL cloud inválida para confirmar que no imprime el valor sensible de conexión. El recuento final de unidades y build de cierre se anexa al terminar.

## Errores de preparación corregidos

Docker apagado produjo ECONNREFUSED en la primera lectura; se inició y la lectura se repitió correctamente. Tipos instalados de pg no declaraban enableChannelBinding aunque la implementación sí lo soporta: se extendió el tipo local sin actualizar paquetes ni usar any. El runner necesitó tipado explícito del entorno por las declaraciones adicionales de Next.js; se corrigió y se repitió el build. No se cambió la lógica comercial ni el diseño.

## Reproducir sin tocar bases existentes

```powershell
npm run test:deployment -- prepare
npm run validate
npm test
npm run test:deployment -- integration
# Detener servidores antes de build:
npm run build
# Terminales separadas:
npm run test:deployment -- start-base
npm run test:deployment -- start-auth
npm run test:deployment -- start-checkout
npm run test:deployment -- start-analytics
# Otra terminal:
npm run test:deployment -- http
npm run test:deployment -- browser
npm run test:deployment -- observability
npm run test:deployment -- restart
```

Las bases quedan conservadas para inspección; no se borran automáticamente. La huella habitual se compara con check:local-preservation -- after. Su archivo before no se sobrescribe automáticamente, para no perder la evidencia inicial.

## Pendiente y separación de commits

No se comprobó conexión, TLS, permisos, build o sesiones en Neon/Vercel reales: se hará después de crear/configurar manualmente las cuentas y con nueva autorización. GA4 sigue desactivado; DebugView real y sandbox Webpay manual pendientes. La revisión pública futura será manual y acotada, sin suites de carga.

Consultar [dos commits propuestos](commit-plan-stage5-deployment.md). Una instantánea ignorada previa a preparación conserva los 44 archivos de etapa 5 y sus hashes. Permite versionar su cierre primero y después el delta cloud, sin descartar archivos actuales ni mezclar historiales. No se realizó ninguna operación de commit/push.

## Cierre final

2026-11-05T18:07:57-03:00: preparación de despliegue finalizada. 23 unitarias, 14 integraciones PostgreSQL, 8 HTTP y 18 navegador = 63 pruebas exitosas; reinicio y observabilidad/exportaciones exitosos. validate (lint/TypeScript/Prisma) y build final correctos; manifiesto sin funciones Edge. Auditoría de producción cero vulnerabilidades. Comparación READ ONLY de ocho tablas y _prisma_migrations local coincide exactamente antes/después. Se crearon seis bases locales nuevas autoparts_deploy_*_test; ninguna migración/seed/transacción comercial se ejecutó en la base habitual. No hubo conexión ni migración/bootstrap en Neon: guardas y simulación probaron cero connect con mock; bootstrap real solo en base nueva local. Simulador exclusivo y monitor permanente bloqueado en Vercel; GA4 sigue desactivado por defecto. Sin dependencias nuevas, diseño cambiado, commits, push, despliegue o carga.

Archivos de preparación: engines/lock/scripts npm, prisma.config, pool/target/deployment guard y Prisma, instrumentación/sampler/proveedor de pagos, runtime de layout/handlers; scripts cloud/bootstrap, runner y huella local; tests de despliegue/helpers; ejemplo de entorno y documentación. Instantánea previa de etapa 5 (44 archivos) ignorada con SHA-256 conservada para separar commits sin perder trabajo.

Propuestos: 1) feat: integrar GA4 con consentimiento, Web Vitals y observabilidad; 2) chore: preparar Vercel y Neon con bootstrap seguro. No creados, índice Git intacto.

Pendiente: crear/configurar manualmente Neon y Vercel, verificar TLS/permisos/HTTPS reales; migraciones y bootstrap remotos requieren autorización nueva. DebugView GA4 real y Webpay oficial siguen pendientes.


Auditoría de cierre: 234 archivos revisables sin secretos locales conocidos, claves privadas, enlaces rotos ni rutas excluidas; 44 hashes de la instantánea de etapa 5 correctos. Índice Git sin cambios. Smoke habitual HTTP 200. Una invocación restringida de tsx devolvió uv_os_get_passwd ENOMEM antes de iniciar la consulta; se repitió la comprobación en el entorno local autorizado y la huella de la base volvió a coincidir. No se trató como fallo de aplicación ni se modificaron datos para resolverlo.

## Cierre versionado autorizado por prompt 016

Etapa 5 confirmada en 69fe039280522b79f0b147432cee0afc2778ee6a (44 archivos exactos de su instantánea). Preparación se confirma en un segundo commit separado con el mensaje autorizado; consultar git log y respuesta final para su hash. validate, 23 unitarias y build repetidos con éxito en este cierre; sin cambios de código respecto de la regresión previa de 63 casos. Sin operaciones en base local, Neon, push, despliegue o carga. No se modifican archivos después del segundo commit para registrar su propio hash; la verificación final queda en Git y en la respuesta.
