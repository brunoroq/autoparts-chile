# Carrito de invitados y fusión segura

El carrito anónimo conserva únicamente identificadores y cantidades en `localStorage`, bajo `autoparts:guest-cart:v1`. La lectura ocurre después de hidratar; `POST /api/v1/cart/guest` consulta precios, disponibilidad y stock reales sin escribir en PostgreSQL. Rechaza campos adicionales, IDs repetidos, cantidades fuera de 1–99 y más de 50 líneas. No reserva existencias. El navegador necesita Web Locks (HTTPS o localhost) para serializar cambios y fusiones entre pestañas; si falta almacenamiento o bloqueo seguro, muestra error en lugar de prometer persistencia.

El usuario autenticado conserva el carrito PostgreSQL y el control de versiones existente. Checkout continúa protegido. El evento `add_to_cart` anónimo usa la cotización del servidor y se emite después de guardar la adición, mediante el proveedor de Analytics existente que exige consentimiento. La fusión no debe generar otro evento; checkout debe esperar su resolución antes de emitir `begin_checkout`.

## Fusión e idempotencia

Se requiere un comprobante duradero para distinguir un reintento de una segunda adición. Una marca solo en el navegador no puede resolver una respuesta perdida después de confirmar la transacción. Implementación mínima: nueva tabla `CartMergeReceipt` con `id` UUID único (clave de operación), `userId` referenciado a `User`, `requestHash` y `createdAt`. No modificar migraciones históricas ni registros de pedidos. Se crean el comprobante y las cantidades en una sola transacción corta. La clave primaria del comprobante serializa reintentos; un upsert del carrito incrementa su versión y toma el mismo bloqueo de fila usado por el control de versiones existente. Un P2002 por reintento revierte la transacción perdedora y consulta el comprobante confirmado antes de devolver el carrito actual. Reintentos con misma identidad/contenido devuelven el carrito actual sin sumar; una clave reutilizada con otro contenido o usuario se rechaza.

La suma por producto respeta 99 unidades y stock actual. Si hay algún conflicto, revertir toda la fusión, explicar el problema y conservar íntegro el carrito anónimo para que pueda editarse. No ajustar ni descartar cantidades silenciosamente. La copia local pendiente (clave, usuario e IDs/cantidades) se guarda antes del envío y se elimina únicamente después de confirmar éxito; errores técnicos conservan esa misma operación para reintentar.

**Estado:** implementación local completa. El usuario autorizó la migración nueva exclusivamente en bases locales de pruebas. La migración `20261106010000_guest_cart_merge` es aditiva: crea solo `CartMergeReceipt`, su índice y FK; no modifica migraciones anteriores, precios, stock ni órdenes existentes. No se aplicó en Docker habitual ni Neon. Antes de una publicación futura será necesario autorizar y aplicar esta migración en el destino correcto; el build no la aplica.

El registro desde la interfaz inicia sesión mediante el flujo Credentials/CSRF existente y fusiona antes de continuar a la ruta solicitada. El login hace lo mismo. Ante error se vuelve a carrito, se conserva la copia anónima y se explica cómo reintentar. Checkout espera la fusión antes de renderizar su resumen y emitir begin_checkout. La identidad siempre se obtiene de la sesión; nunca del cuerpo del cliente. Los comprobantes se conservan sin caducidad automática para permitir reintentos tardíos, incluso después de eliminar artículos o comprar.

## API

- `POST /api/v1/cart/guest`: público, lectura de catálogo, Origin canónico y JSON limitado a 8 KiB. Cuerpo `{ items: [{ productId, quantity }] }`. Respuesta `{ data: CartSnapshot }`; precios actuales, advertencias y productos ausentes representados para poder eliminarlos. No escribe datos ni acepta precios.
- `POST /api/v1/cart/merge`: sesión obligatoria, Origin canónico, sin precios ni userId en el cuerpo. Cuerpo `{ mergeId: UUID, items: [{ productId, quantity }] }`. Responde carrito actual y ETag; sin evento Analytics adicional. Misma clave/mismo usuario/contenido normalizado: no vuelve a sumar. Otra identidad/contenido: 409 MERGE_KEY_CONFLICT. Stock insuficiente: 409 STOCK_CONFLICT; producto inactivo/ausente: 404 PRODUCT_NOT_FOUND. Todos los cambios y el comprobante se revierten ante conflicto. No necesita If-Match: suma sobre el carrito bloqueado actual; incrementa version para invalidar ediciones previas.
- Ambos endpoints reutilizan no-store, Server-Timing y registro seguro de duración/errores. No se registran cuerpos, sesiones ni almacenamiento local.

## Verificación reproducible local

Mantener DATABASE_URL de la raíz apuntando a Docker. Los scripts existentes rechazan hosts externos y bases de escritura sin sufijo _test. No cargar .env.neon.local para estas pruebas.

1. `npm run test:deployment -- prepare`: aplica migrate deploy en las bases Docker autoparts_deploy_*_test y prepara el catálogo aislado. Nunca usar migrate reset ni db push.
2. `npm run validate`, `npm test` y `npm run build`.
3. `npm run test:deployment -- integration`: incluye la nueva integración de fusión.
4. En terminales separadas: `npm run test:deployment -- start-base` (3000), `start-auth` (3002), `start-checkout` (3004), `start-analytics` (3005) y `start-guest` (3012), usando el mismo prefijo npm run test:deployment -- en cada comando.
5. Con los servidores activos: `npm run test:deployment -- http` y `npm run test:deployment -- browser`. Chrome instalado es requisito de Playwright. Las pruebas GA4 interceptan Google y usan un ID de prueba; no envían datos reales a Google.
6. Revisión manual en http://localhost:3012: agregar productos sin sesión, recargar, editar/eliminar; continuar al checkout y registrar una cuenta de demostración. Se inicia sesión, fusiona y muestra el checkout simulado. También probar login con cuenta que ya tenga carrito. No usar contraseñas reales o reutilizadas. Detener los servidores al terminar.

## Resultados

- Lint, TypeScript, validación de Prisma y build de producción correctos.
- 25 unitarias, 16 integraciones PostgreSQL y nueve HTTP exitosas.
- 32 casos de navegador comprobados en móvil/escritorio. La última suite completa pasó 30; los dos restantes pasaron al acotar el selector del aviso, que coincidía también con el anunciador de rutas de Next.js. Una primera pasada detectó además una espera faltante después del logout en una prueba; se corrigió.
- Cobertura nueva: recarga y persistencia anónima; IDs/cantidades manipulados; precios del servidor; suma de carritos; claves repetidas/contenido distinto/otro usuario; cuatro reintentos simultáneos; dos fusiones diferentes concurrentes; fusión frente a CAS autenticado; recuperación desde otro cliente y tras respuesta perdida; reintento después de eliminar; rollback integral ante stock/inactivos/máximo 99; registro/login y checkout; modificaciones en dos pestañas; GA4 invitado con consentimiento y sin duplicación por fusión. Regresión de catálogo, cuentas, checkout simulado, órdenes, GA4 y Web Vitals.
- La huella final de Docker habitual coincidi? exactamente con la inicial para sus ocho tablas y metadatos de migraciones. No se consulta Neon durante esta tarea.

## Archivos afectados

- Esquema: prisma/schema.prisma y prisma/migrations/20261106010000_guest_cart_merge/migration.sql.
- Servidor: src/modules/cart/{service,merge,guest-validation,guest-quote}.ts; src/app/api/v1/cart/{guest,merge}/route.ts.
- Cliente: src/lib/cart/{guest-storage,guest-client}.ts; src/components/cart/{add-to-cart,cart-view,cart-controller,checkout-cart}.tsx; src/components/auth/auth-form.tsx; páginas src/app/{carrito,checkout}/page.tsx.
- Pruebas: tests/guest-cart{,.integration,.http}.test.ts y tests/browser/{guest-cart,auth,analytics}.spec.ts; scripts/deployment-checks.ts, scripts/start-auth-test-server.ts y package.json.
- Documentación: AGENTS.md, LogFile.txt, README.md, docs/guest-cart.md y docs/decisions/README.md.

## Límites

El carrito anónimo pertenece a este origen y navegador; no se sincroniza entre dispositivos ni se conserva si el usuario borra el almacenamiento. No reserva stock y el checkout sigue validándolo antes de confirmar la compra. Los comprobantes son idempotencia de una operación concreta, no prueba de recepción de GA4. No se añade una cola de reintentos ni limpieza automática. Los navegadores sin almacenamiento o Web Locks muestran un error; no se afirma persistencia cuando no puede garantizarse. No se agregaron dependencias ni cambios visuales/CSS. Sin autorización adicional no hay commits, push, despliegues, migraciones Neon ni pruebas de carga.
