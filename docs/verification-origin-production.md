# Corrección de origen del carrito — 2026-11-06

## Causa confirmada

Se consultaron únicamente dos GET públicos de `https://autoparts-chile.vercel.app`, sin sesión ni escrituras. `/api/auth/providers` respondió 200 y publicó signinUrl/callbackUrl con origen `https://autoparts-store.vercel.app`. `/api/v1/cart` respondió 401 UNAUTHENTICATED, no 403. Estos datos demuestran que la autenticación desplegada mantiene el dominio anterior como URL canónica. La validación usa NEXTAUTH_URL; comparar el Origin del dominio estable con esa URL anterior produce exactamente INVALID_ORIGIN.

La consulta de invitado es `POST /api/v1/cart/guest`, aunque solo cotiza mediante SELECT. Tanto abrir el carrito como agregar un producto llaman a ese endpoint. No se está rechazando el GET de la página por CSRF. La fusión autenticada usa `POST /api/v1/cart/merge`, con la misma protección. Cambiar DATABASE_URL no cambia el origen esperado y no resuelve el problema.

No se enviaron POST de prueba a producción. No se modificaron variables ni despliegues Vercel durante el diagnóstico.

## Corrección local

- Conservar NEXTAUTH_URL como autoridad configurada: en Production su valor debe ser exactamente `https://autoparts-chile.vercel.app`; localmente, el origen real con puerto, por ejemplo `http://localhost:3000`. Se documenta en .env.example; no se modificó ningún archivo privado.
- `checkOrigin` protege POST/PUT/PATCH/DELETE; omite GET/HEAD/OPTIONS, que no deben modificar estado. Configuración ausente, malformada, con credenciales/ruta/query/hash o HTTP en Vercel falla con CONFIGURATION_ERROR seguro.
- Origin debe coincidir exactamente. Se rechazan Origin ausente, null, listas, terceros, dominios parecidos, preview y downgrade HTTP. Sec-Fetch-Site cross-site también se rechaza, sin exigir esta cabecera a clientes que no la envían.
- Host, si llega, debe corresponder al host/puerto configurado. En Vercel, X-Forwarded-Host presente debe coincidir también, sin aceptar listas. Ninguna cabecera autoriza nuevos orígenes: no hay comodines *.vercel.app, fallback a Host ni deducción desde una URL interna del proxy. Fuera de Vercel no se confía en X-Forwarded-Host.
- Vercel documenta Host como el dominio visitado y X-Forwarded-Host idéntico. La URL interna HTTP de Request no tiene que coincidir con el origen HTTPS público: las pruebas cubren ese transporte sin relajar el Origin externo.
- Se conservan los controles de sesión, CSRF de NextAuth, JSON limitado, validaciones de precios/cantidades/stock, idempotencia y consentimiento GA4. No hay cambios de migración o pagos.

La corrección deliberadamente no oculta una NEXTAUTH_URL equivocada: actualizar esta variable privada en Vercel sigue siendo necesario para corregir producción, incluido login/cookies/callbacks y la URL canónica de Analytics.

## Estado de Neon: lectura autorizada por el diagnóstico

Se validaron en memoria las conexiones del archivo privado: directa/pooled del mismo endpoint, neondb, São Paulo y TLS verify-full. Se usó default_transaction_read_only y BEGIN READ ONLY. Solo se consultaron metadatos, sin valores de cuentas, carritos o pedidos. Las seis migraciones anteriores están terminadas y no revertidas; CartMergeReceipt no existe y User.id tiene tipo UUID.

Está pendiente `20261106010000_guest_cart_merge`, creada en el commit del carrito. Su tabla nueva, índice y FK son compatibles con el esquema conocido y no modifican filas de las tablas existentes. No es la causa del 403: el origen se verifica antes de consultar esa tabla. Una vez corregido el dominio, la fusión todavía fallaría mientras falte la migración. No se aplicó ni se reescribió ninguna migración. La consulta de metadatos no sustituye la revisión completa de checksums, PK, permisos y respaldo antes de migrar.

## Verificaciones

Prueba nueva `tests/origin.test.ts`: reproducción exacta dominio anterior/estable, URL interna detrás del proxy, métodos de lectura, Origin inválido/ausente, Host y X-Forwarded-Host falsos, listas, preview, Sec-Fetch-Site, configuración inválida y puertos locales distintos. Se incluye en npm test.

Se amplió `tests/guest-cart.http.test.ts`: GET autenticado sin Origin devuelve 200; cotización y fusión POST sin Origin devuelven 403; Host falso devuelve 403; cotización legítima devuelve precios reales. Se actualizó la prueba existente de rechazo de origen para que pruebe POST, no GET.

Lint, TypeScript, Prisma, 26 unitarias, nueve HTTP, los 32 casos de navegador móvil/escritorio y build correctos. HTTP/navegador usan solo bases Docker _test existentes; no se ejecutan migraciones en esta tarea. Los tests GA4 interceptan Google y usan ID de prueba. Los cinco servidores temporales se detuvieron al terminar.

## Publicación segura, pendiente de autorizaciones

1. Revisar este diff y autorizar el commit local si se desea; no se creó uno durante la corrección.
2. En Vercel, verificar el proyecto servido por autoparts-chile.vercel.app y el ámbito Production. Con autorización para el cambio, fijar NEXTAUTH_URL a ese origen exacto; conservar NEXTAUTH_SECRET, DATABASE_URL pooled y PAYMENT_PROVIDER=simulated. No habilitar previews contra production ni agregar el dominio anterior como bypass.
3. Antes de migrar, confirmar proyecto/rama/base en el panel, historial/checksums, PK de User.id y permisos; respaldar y probar restauración aislada según [procedimiento de migración](neon-guest-cart-migration.md). Solicitar aprobación específica para el respaldo y para la migración remota. Aplicar solo la pendiente con el script protegido cloud:migrate y --execute tras comprobar que no hay otras pendientes. No repetir bootstrap/seed.
4. Verificar por SELECT siete migraciones terminadas, CartMergeReceipt con PK/FK/índice, permisos runtime y conservación de datos. Ante cualquier fallo, detenerse sin reparaciones automáticas.
5. Solo después de autorizar push y despliegue, publicar la corrección con NEXTAUTH_URL actualizada; Vercel debe recibir la variable en el nuevo deployment. Un push puede activar despliegue automático: coordinar ese comportamiento antes de publicarlo. Build: npm run build, sin migraciones incorporadas.
6. Con pocas operaciones manuales autorizadas: comprobar providers con URLs del dominio estable; carrito invitado, agregar/editar/recargar, login/registro, fusión sin duplicados, checkout simulado y GA4 con consentimiento. Verificar cookies seguras y ausencia de 403 legítimos/500 por tabla faltante. Sin estrés, k6 ni pagos externos.

La aplicación anterior tolera la tabla aditiva; migrar antes del deployment nuevo. No eliminar comprobantes al revertir una versión de aplicación. Para una mitigación solo de configuración del 403 también hace falta autorizar el cambio de variable y su redeploy, y no resolvería la fusión mientras falte la tabla.

Referencia oficial del proxy: [cabeceras de solicitud Vercel](https://vercel.com/docs/headers/request-headers).
