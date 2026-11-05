# Verificación de etapa 3

Actualización de cierre: prompt 010 autoriza el commit conjunto de etapas 2 y 3. Las cifras y referencias a cambios pendientes del informe corresponden a su verificación original; consultar Git y la entrada 010 de LogFile.txt para el cierre actualizado.

Fecha: 4 de noviembre de 2026 (America/Santiago). Autorización: prompt 009. Etapas 2 y 3 sin commit; último commit existente `4d224a6`. Sin despliegue ni etapa 4.

## Resultado funcional

Registro, login/logout y sesiones JWT con NextAuth 4.24.15. Contraseñas con scrypt asíncrono nativo y sal aleatoria. Protección de `/carrito` y de cada endpoint privado mediante sesión de servidor y propietario en PostgreSQL. Carrito persistente con agregar, cambiar cantidad, eliminar y consultar; precios/subtotales/total desde Product y stock validado sin reservarlo.

Control de versiones con If-Match, actualización condicional y modificación de líneas en una sola transacción. Una carrera real con la misma versión produce una escritura y un 409; la interfaz vuelve a consultar y explica el conflicto sin repetir el incremento. Registro duplicado concurrente produce una sola cuenta. El diseño anterior se conserva; únicamente se agregan acciones de cuenta/carrito en cabecera, botón de agregar en detalle y tres pantallas nuevas.

## Verificaciones ejecutadas

| Prueba | Resultado |
| --- | --- |
| Compatibilidad previa | App temporal 3103: build Next 16.4.5/React 19.3.1, Credentials/CSRF, JWT, getServerSession, cookie HttpOnly/SameSite y logout correctos. Sin cambio de stack. |
| Migración | `20261105011000_users_cart` aplicada en desarrollo, catálogo de pruebas y autenticación aislada; sin reescribir migraciones ni borrar productos. |
| Unitarias | 10/10 entre catálogo y autenticación: hash/sal/verificación, formato, validación, límites, origen, JSON, versiones, cantidades y errores. |
| Integración usuarios/carrito | 1 caso compuesto exitoso: dos registros simultáneos, CAS concurrente, aislamiento, rollback de versión, stock intacto, totales vigentes y otra conexión Prisma. |
| Regresión integración catálogo | 1 caso compuesto exitoso sobre 10.000 productos aislados: semilla, búsqueda, filtros, orden, paginación y protección de reducción. |
| HTTP autenticación/carrito | 4/4: registro/login/logout/persistencia; cookies; dos usuarios y dos mutaciones; expiración/token manipulado; CSRF; origen; retorno externo; 429 con Retry-After. |
| HTTP catálogo | 3/3 sin regresiones. |
| Error HTTP 500 | 1/1 contra servidor temporal 3001 con conexión inválida; sin filtrar conexión ni alterar PostgreSQL. |
| Navegador | 10/10: cinco recorridos por cada resolución 1440x1000 y 390x844; cuenta/carrito/conflicto y regresión de catálogo/teclado. |
| Reinicio y privacidad | Servidor efímero 3104 reiniciado: sesión y carrito persistieron; logout/login conserva líneas. stdout/stderr capturados sin contraseña, hash, cookie, CSRF ni secreto conocidos. |
| Smoke | Inicio, catálogo, detalle, APIs e imagen optimizada respondieron correctamente. |
| Lint/TypeScript/Prisma | `npm run validate` exitoso, sin advertencias de lint. |
| Build de producción | Exitoso; páginas y APIs de cuenta/carrito dinámicas. |
| Auditoría | `npm audit --omit=dev`: cero vulnerabilidades. Se mantienen ocho avisos moderados conocidos de tooling, sin actualizaciones forzadas. |
| Base habitual | User=0, Category=6, Product=30, Cart=0, CartItem=0, Order=0, OrderItem=0, PaymentAttempt=0 al verificar. No se crearon cuentas ficticias en la tienda. |

Las pruebas de autenticación escriben exclusivamente en `autoparts_auth_test`, con 30 productos y usuarios sintéticos únicos generados por ejecución. Las de catálogo usan `autoparts_catalog_test`, con 10.000. No son pruebas de carga; la concurrencia se limita a parejas funcionales pequeñas.

## Revisión local

Con Docker activo, `.env` configurado y desde la raíz:

```powershell
npm ci
npm run db:up
npm run db:generate
npm run db:deploy
npm run db:seed -- --size 30
npm run validate
npm test
# Detener npm start/dev antes de reconstruir:
npm run build
npm start
```

La implementación inicial ya configuró NEXTAUTH_URL=http://localhost:3000 y un secreto aleatorio en `.env` ignorado. No copiar `.env.example` sobre ese archivo existente. En otro equipo, elegir valores locales y generar NEXTAUTH_SECRET conforme a [contrato](api/auth-cart.md). No incluir la salida del secreto en logs ni commits.

1. Abrir http://localhost:3000/registro y crear una cuenta propia con contraseña de al menos 12 caracteres.
2. Iniciar sesión, abrir un producto, elegir cantidad y agregar.
3. Consultar `/carrito`, actualizar y eliminar; no existe acción de checkout.
4. Salir y volver a entrar: el carrito sigue en PostgreSQL.
5. Abrir el carrito en dos pestañas; modificar en una y luego enviar un cambio desde la otra sin recargar: se explica el conflicto y se recupera la versión vigente.

## Repetir pruebas aisladas

```powershell
npm run test:auth:prepare
npm run test:auth:integration
npm run test:auth:server
```

El servidor de pruebas usa localhost:3002, una base local `_test` y secreto derivado distinto del habitual. En otra terminal:

```powershell
npm run test:auth:http
npm run test:browser
npm run test:auth:restart
```

La regresión de catálogo en navegador requiere también localhost:3000 activo. `test:auth:restart` administra y cierra su servidor 3104. `test:auth:compat` genera una app temporal ignorada y administra 3103. No se usan credenciales reales ni cuentas predefinidas. Detener todos los servidores propios antes de reconstruir. Los intentos están limitados también en tests; reiniciar el servidor aislado restablece sus contadores en memoria, sin modificar la política del servidor habitual.

## Inventario de etapa 3

Creado:

- `src/lib/auth/options.ts`, `session.ts`, `password.ts`, `rate-limit.ts`.
- `src/lib/http/errors.ts`, `input.ts`; `src/types/next-auth.d.ts`.
- `src/modules/users/service.ts`, `validation.ts`; `src/modules/cart/service.ts`, `validation.ts`.
- `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/v1/users/route.ts`, `src/app/api/v1/cart/route.ts`, `src/app/api/v1/cart/items/route.ts`, `src/app/api/v1/cart/items/[productId]/route.ts`.
- `src/app/(auth)/registro/page.tsx`, `src/app/(auth)/iniciar-sesion/page.tsx`, `src/app/carrito/page.tsx`.
- `src/components/auth/auth-form.tsx`, `sign-out-button.tsx`; `src/components/cart/add-to-cart.tsx`, `cart-view.tsx`.
- Migración `prisma/migrations/20261105011000_users_cart/migration.sql`.
- `tests/auth.test.ts`, `auth.integration.test.ts`, `auth.http.test.ts`, `auth-http-helpers.ts`, `auth-database.ts`, `tests/browser/auth.spec.ts`.
- `scripts/check-auth-compat.mjs`, `prepare-auth-tests.ts`, `start-auth-test-server.ts`, `check-auth-restart.ts`.
- `docs/api/auth-cart.md` y este informe.

Modificado: schema Prisma; helper de instrumentación; CatalogError para compartir ApiError sin cambiar su contrato; cabecera, detalle y CSS de componentes nuevos; package/lockfile; `.env.example` y `.env` local ignorado; eslint/tsconfig/gitignore para excluir la app temporal; README, AGENTS, LogFile, propuesta, arquitectura, base de datos, plan y decisiones.

Dependencia nueva: next-auth 4.24.15 y sus transitivas; sin adaptador Prisma Auth.js, biblioteca de hash, servicio de correo, Redis ni cambios de versiones del stack.

## Problemas y decisiones

- La compatibilidad v4 no presentó incompatibilidad importante; no fue necesario detener la integración ni proponer cambio de stack.
- Se respetó el formato de respuesta de callback NextAuth para el rate limit; un JSON REST genérico rompería el cliente signIn. Se conservan cookies y redirects al instrumentar.
- El aislamiento de pruebas evita que las verificaciones de cuenta alteren usuarios o carritos habituales; las cuentas sintéticas quedan para inspección, sin borrado automático.
- La limitación de hash protege memoria; el costo real de scrypt permanece en pruebas. Auth.js puede presentar errores de authorize como fallos de acceso; los límites previos al callback sí devuelven 429 explícito.
- Un patrón de Prettier con paréntesis no encontró las páginas `(auth)`; no fue error de TypeScript/build. Un parche documental compuesto se rechazó sin cambios parciales por contexto y luego se aplicó por archivos.
- Se usó Playwright de desarrollo y Chrome existente para automatización; no se controló una cuenta real del usuario. Se revisaron capturas de carrito en escritorio/móvil además de las aserciones.
- Los contadores de intentos son locales al proceso y no distribuidos; JWT no proporciona revocación global inmediata de tokens copiados. La versión del carrito no congela precios ni reserva stock. [Límites y contratos](api/auth-cart.md).

Sin checkout, Transbank, GA4, generadores de tráfico, despliegue, etapa 4 ni commit final. Último commit sigue siendo `4d224a6`; las etapas 2 y 3 están pendientes de autorización para versionar.

Cierre: servidor habitual localhost:3000 y PostgreSQL activos. Servidores de prueba 3001/3002 y efímeros 3103/3104 detenidos. Auditoría de 167 archivos candidatos y 42 enlaces: sin secretos locales ni artefactos excluidos; lockfile sincronizado, diff --check correcto. Las cifras incluyen documentación y cambios de etapa 2 todavía no versionados.
