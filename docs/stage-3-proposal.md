# Propuesta de etapa 3: usuarios, autenticación y carrito

Fecha: 2026-11-04, America/Santiago. Estado: aprobada por prompt 009 e implementada; ver [verificación de etapa 3](verification-stage-3.md). Se conserva el diseño de etapa 2. Las etapas 2 y 3 continúan sin commit; la implementación no autoriza crearlo.

## Arquitectura y dependencias

Conservar Next.js App Router, Node.js, Prisma y PostgreSQL con los mismos servicios compartidos entre páginas y Route Handlers. Agregar módulos concretos `users`, `auth` y `cart`; reutilizar componentes y pruebas existentes. Sin microservicios, Redis, proveedor de identidad externo ni estado global de carrito en navegador.

Dependencia nueva propuesta: `next-auth@4.24.15` estable (familia Auth.js/NextAuth). Consulta npm del 2026-11-04: latest=4.24.15, beta=5.0.0-beta.32; ambas declaran peers para Next 16/React 19. Elegir estable; no instalar beta silenciosamente. Configuración v4 con Credentials y `getServerSession`, no copiar APIs v5 como `auth()` sin adaptación. Verificar funcionamiento efectivo en Next 16.4.5/React 19.3.1 antes de construir los flujos; si esa comprobación falla, presentar el problema y alternativa para aprobación, sin degradar Next ni usar force/legacy-peer-deps.

No agregar adaptador Prisma de Auth.js: Credentials valida contra nuestro User mediante Prisma y utiliza sesiones JWT. No se requieren Account, Session o VerificationToken ni tablas para proveedores no utilizados. El registro es responsabilidad del servicio de usuarios; Credentials no persiste usuarios por sí mismo.

Contraseñas mediante `node:crypto` nativo; validación manual tipada, sin biblioteca nueva. Mantener ESLint 9 y las herramientas actuales de pruebas, incluido Playwright.

## Registro y contraseñas

- Formulario de nombre, correo, contraseña y confirmación. Nombre de 2..120 caracteres; correo hasta 254, trim y minúsculas para registro y login. Contraseña 12..128 caracteres, con límite adicional de bytes; no recortarla ni truncarla silenciosamente.
- Nueva columna `User.passwordHash` nullable para conservar posibles filas anteriores; las altas nuevas requieren hash. Usuarios sin hash no pueden iniciar sesión con contraseña. No almacenar contraseña ni confirmación en texto plano, cookies, sesión, logs o respuestas.
- Usar `crypto.scrypt` asíncrono con N=131072 (2^17), r=8, p=1, sal aleatoria de 16 bytes y derivación de 64 bytes; configurar maxmem suficiente, inicialmente 192 MiB. Guardar algoritmo, parámetros, sal y hash en un formato versionado; comparación mediante timingSafeEqual y validación del formato.
- Decisión: scrypt es una opción recomendada por OWASP cuando no se utiliza Argon2id y está disponible en Node, evitando otra dependencia nativa. No presentarlo como costo gratuito: medir duración/memoria del hashing y mantener parámetros constantes; no bajar seguridad para mejorar una futura prueba de rendimiento.
- Correo único, validación en servicio y restricción única PostgreSQL para resolver altas simultáneas. Antes de cualquier normalización de datos previos, detectar correos incompatibles o colisiones y detener migración; no fusionar ni renombrar usuarios automáticamente.
- Registro transaccional de usuario y su carrito. Inicio de sesión con mensaje genérico si correo/contraseña son incorrectos; usar comprobación ficticia de hash para usuario inexistente, sin prometer tiempos idénticos de red.
- Límite sencillo de intentos para registro/login con memoria acotada y expiración por proceso; incluir 429 y Retry-After. Documentar que no es distribuido y no garantiza protección conjunta entre instancias. No añadir CAPTCHA, correo transaccional, recuperación de contraseña u OAuth en este alcance.

## Sesiones y autorización

Credentials + `session.strategy="jwt"`; cookie gestionada por la biblioteca, HttpOnly y SameSite=Lax, Secure en HTTPS. Duración propuesta: ocho horas, con política de expiración/renovación documentada. Secret aleatorio al menos de 32 bytes en NEXTAUTH_SECRET; NEXTAUTH_URL canónica. Ambos documentados sin secretos en .env.example; no escribir secretos reales en LogFile.

JWT contiene identificador mínimo; la sesión expone id/nombre/correo, nunca hash. Resolver sesión directamente en servidor con getServerSession, sin HTTP interno. Para recursos privados verificar también que el usuario aún exista y obtener el propietario desde la sesión, nunca desde un userId enviado por el cliente.

`/carrito` redirige al acceso cuando no hay sesión. API privada devuelve 401 JSON, no HTML de login. Consultas y mutaciones se restringen al carrito del usuario autenticado. Un ID ajeno no permite acceso ni modificación y devuelve 404 sin revelar su existencia. No confiar únicamente en ocultar enlaces o validar un layout; verificar cada handler/servicio privado.

Logout elimina la cookie del navegador actual. JWT sin tabla de sesiones no ofrece revocación global inmediata de tokens ya copiados antes de su expiración; no se promete cerrar sesiones de otros dispositivos. No se implementa esa función en esta etapa.

Conservar CSRF de Auth.js para acceso/cierre de sesión. Para registro y mutaciones JSON de carrito: comprobar Origin contra el origen canónico configurado, Content-Type y tamaño de cuerpo acotado. URLs de retorno limitadas al sitio. No registrar cuerpos de login, cookies, tokens, correo ni hash. En futuras pruebas k6 se recorrerá el flujo CSRF/cookies real, sin endpoint de bypass.

## Carrito persistente

Reutilizar Cart y CartItem existentes y sus restricciones únicas. Agregar `Cart.version Int @default(0)` y un CHECK SQL quantity <=99 (quantity >0 ya existe). Toda escritura obtiene identidad desde sesión y ocurre en una transacción.

- Agregar: validar producto activo, cantidad entera entre 1 y 99 y cantidad final <= min(99, stock). Si ya existe, incrementar su cantidad, sin duplicar la fila.
- Modificar: establecer cantidad absoluta con las mismas reglas. Cero no elimina implícitamente; usar DELETE.
- Eliminar: retirar solo el producto del carrito autenticado. No borrar el producto de catálogo.
- Consultar: líneas con precio vigente desde Product, subtotales y total calculados en servidor en CLP. Ignorar/rechazar precio, total o userId suministrados por el cliente.
- Stock en carrito se valida pero no se reserva ni descuenta. Varios usuarios pueden añadir el mismo producto. La reserva/consumo y revalidación definitiva pertenecen al checkout futuro.
- Si stock, precio o actividad cambian después de añadir, GET conserva la línea y muestra disponibilidad/advertencia y precio actual, sin eliminarla automáticamente. El total es informativo, no una compra confirmada.
- Persistencia en PostgreSQL después de logout/login o reinicio de aplicación. No crear carrito anónimo, fusión de carritos ni almacenamiento paralelo en localStorage.

## Concurrencia básica

GET devuelve `version` y ETag. Las mutaciones requieren `If-Match` con esa versión. Dentro de la transacción, actualizar Cart condicionalmente por id/propietario/version e incrementar version; luego validar y modificar ítems. Si algo falla, rollback de todo el cambio, incluida la versión.

Dos solicitudes sobre la misma versión no pisan cambios: una gana y la otra recibe 409 CART_CONFLICT; el cliente vuelve a consultar y explica el conflicto, sin repetir automáticamente un incremento ambiguo. Falta de precondición: 428; cantidades/stock incompatibles: 409; estructura inválida: 400. Documentar esta semántica para pruebas futuras. Usar timeout de transacción y manejar conflictos de base de forma controlada, sin reintentos ilimitados.

Precio/stock se validan en el snapshot de la transacción; version detecta cambios del carrito, no constituye una reserva de productos. No implementar bloqueos globales, colas, event sourcing ni una tabla de idempotencia para el carrito.

## Páginas e integración mínima

| Ruta | Contenido |
| --- | --- |
| `/registro` | Crear cuenta y luego acceder |
| `/iniciar-sesion` | Login y retorno local seguro |
| `/carrito` | Página privada con líneas, cantidades, eliminar y total informativo |

Conservar estilos y estructura visual aprobados. Añadir solo acceso, salir y enlace al carrito en cabecera; acción de agregar en detalle de producto. No rediseñar inicio, tarjetas, hero, imágenes ni catálogo. Si un visitante agrega sin sesión, dirigir al acceso y volver al producto, sin alterar datos ni agregar automáticamente con un GET. Formularios con etiquetas, errores accesibles, autocomplete adecuado, estados de envío y foco visible. Sin botón de checkout.

## Endpoints

| Método/ruta | Función |
| --- | --- |
| POST `/api/v1/users` | Registro; 201 sin hash, 400 inválido, 409 duplicado, 429 límite |
| GET/POST `/api/auth/[...nextauth]` | Endpoints oficiales de sesión, CSRF, callback Credentials y logout |
| GET `/api/v1/cart` | Carrito del usuario; total, disponibilidad, version y ETag |
| POST `/api/v1/cart/items` | Agregar productId y quantity con If-Match |
| PATCH `/api/v1/cart/items/[productId]` | Establecer quantity absoluta con If-Match |
| DELETE `/api/v1/cart/items/[productId]` | Eliminar del carrito con If-Match |

La identidad del recurso item se fija como productId para evitar ambigüedad con CartItem.id. No habilitar GET de otro carrito por userId. Los endpoints Auth.js conservan su protocolo oficial; no inventar `/api/v1/login` ni emitir tokens propios. Para pruebas futuras documentar GET CSRF, POST callback/credentials, cookies de sesión, GET cart y If-Match. Los handlers propios mantienen contratos JSON de errores y respuestas no-store. No se escribe k6.

## Instrumentación

Generalizar el helper existente sin romper catálogo: método HTTP variable, ruta normalizada, requestId, estado, totalMs, dbMs y authMs/hashMs cuando se midan. Diferenciar tiempo Prisma de costo de hash y de obtención de sesión. No forzar las respuestas/cookies/redirects de Auth.js al formato de nuestra API: envolver su handler respetando status y headers originales y medir authorize internamente.

Medir desde entrada al handler hasta preparar respuesta; no llamarlo latencia completa de red. Logs JSON y Server-Timing en rutas propias; conservar Cache-Control no-store. Sin escribir logs en PostgreSQL ni agregar backend de telemetría. Registrar 401/403/409/428/429 como categorías distintas para no confundir validaciones esperadas con fallos internos bajo carga futura.

## Archivos afectados (después de aprobación)

- `package.json`, `package-lock.json`: next-auth exacto y extensión de scripts de tests.
- `prisma/schema.prisma` y migración nueva: passwordHash, Cart.version y restricciones; revisión de datos previos. Mantener semillas de productos independientes de usuarios.
- `.env.example`: NEXTAUTH_URL y NEXTAUTH_SECRET de ejemplo; `.env` local ignorado con secreto generado al configurar.
- `src/lib/auth/{options,session,password,rate-limit}.ts` y `src/types/next-auth.d.ts`: configuración, hash y tipos mínimos necesarios.
- `src/modules/users/{service,validation}.ts` y `src/modules/cart/{service,validation}.ts`: reglas y persistencia. No crear capas vacías.
- `src/lib/observability/request.ts`: generalización compatible; helper mínimo para origen/cuerpo/errores compartidos si hace falta.
- `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/v1/users/route.ts`, `src/app/api/v1/cart/route.ts`, `src/app/api/v1/cart/items/route.ts`, `src/app/api/v1/cart/items/[productId]/route.ts`.
- `src/app/(auth)/registro/page.tsx`, `(auth)/iniciar-sesion/page.tsx`, `src/app/carrito/page.tsx` y componentes de formularios/carrito concretos.
- `src/components/layout/site-header.tsx`, detalle de producto y estilos solo para integrar nuevas acciones/pantallas con diseño existente.
- Tests unitarios/integración/HTTP/browser; configuración de base aislada y pruebas con dos usuarios independientes, sin credenciales reales versionadas.
- README, AGENTS, LogFile, arquitectura, base de datos, decisiones, `docs/api/auth-cart.md`, `docs/verification-stage-3.md` y guía de entorno/pruebas.

## Orden y verificaciones

1. Comprobación de compatibilidad real NextAuth estable y protocolo de cookies con Next 16; migración aditiva sin tocar productos.
2. Hash/registro y pruebas: no texto plano, sales distintas, validación de formato y longitud, contraseña correcta/incorrecta, correo normalizado y registro simultáneo sin duplicados.
3. Login/logout/sesión real: credenciales incorrectas, expiración, cookie inválida/manipulada, CSRF, origen no permitido y retorno externo rechazado. Usar configuración de expiración breve solo en tests aislados, no alterar defaults para medir más rápido.
4. Autorización: sin sesión 401, redirección de página, A no puede leer/modificar líneas de B; comprobar que respuestas y logs no contienen hash/token/contraseña.
5. Persistencia: agregar, consultar, modificar, eliminar; logout/login conserva líneas. Confirmar lectura desde otra instancia de cliente Prisma y tras reinicio de servidor; no usar mocks como única evidencia.
6. Integridad: producto inexistente/inactivo, stock insuficiente, cantidad 0/negativa/fraccionaria/>99, precio manipulado, cambios posteriores de stock/precio y total recalculado.
7. Concurrencia básica: dos altas con el mismo correo y dos mutaciones con igual versión; una sola cuenta y una sola escritura ganadora, otra 409; sin líneas duplicadas ni cantidades fuera de rango. Son casos funcionales pequeños, no pruebas de carga.
8. HTTP e instrumentación: métodos, códigos, If-Match/ETag, no-store, requestId y tiempos; protocolo Auth.js real con cookie jar y CSRF.
9. Navegador Chrome escritorio/móvil: registro, login, agregar, edición, eliminación, logout, acceso privado y teclado; regresión del diseño/catálogo aprobado.
10. Ejecutar lint, TypeScript, Prisma validate/generate, migraciones, pruebas nuevas y regresión disponible, build de producción y smoke. Documentar resultados, límites y errores; detener el servidor antes de reconstruir.

Las escrituras de pruebas usarán solo bases locales `_test` y usuarios ficticios únicos. No resetear usuarios ni carritos de la tienda habitual. Secretos y contraseñas de prueba se generan en ejecución o se proveen por entorno; no hay cuenta de administrador fija.

## Fuentes verificadas

- [Credentials v4](https://next-auth.js.org/providers/credentials): persistencia propia y sesiones JWT.
- [Next.js y sesión de servidor v4](https://next-auth.js.org/configuration/nextjs).
- [Opciones y variables de sesión](https://next-auth.js.org/configuration/options).
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): parámetros de scrypt.
- Metadatos npm next-auth latest/beta y peerDependencies consultados sin instalar paquetes.
