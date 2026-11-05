# Usuarios, autenticación y carrito (etapa 3)

## Entorno

NextAuth 4.24.15 estable, Credentials, Next.js 16.4.5 y React 19.3.1. Compatibilidad real comprobada primero con una app temporal en puerto 3103: build, React, login/CSRF, JWT, getServerSession, cookie y logout. El script `npm run test:auth:compat` reproduce esa prueba; la app temporal está en tmp ignorado y nunca expone credenciales de compatibilidad en la tienda.

NEXTAUTH_URL es el origen canónico exacto (por ejemplo http://localhost:3000); usar esa dirección al revisar la tienda. NEXTAUTH_SECRET se genera aleatoriamente (48 bytes en la configuración inicial), nunca se versiona y debe permanecer estable entre reinicios. No usar el marcador de .env.example. Ejemplo de generación para configuración local manual: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. No copiar su salida al registro de prompts ni a documentación.

## Registro y contraseñas

POST `/api/v1/users`, JSON: name, email, password, confirmPassword. Origin debe coincidir con NEXTAUTH_URL. Nombre 2..120, correo normalizado con trim/minúsculas y máximo 254. Contraseña 12..128 caracteres Unicode, máximo 512 bytes UTF-8, sin trim ni truncamiento; confirmación exacta. Cuerpo máximo 8 KiB y sin campos adicionales.

Éxito: 201 `{data:{id,name,email}}`. 400 entrada inválida; 409 ACCOUNT_EXISTS; 403 INVALID_ORIGIN; 413 BODY_TOO_LARGE; 415 INVALID_CONTENT_TYPE; 429 RATE_LIMITED o AUTH_BUSY. No devuelve passwordHash.

Scrypt asíncrono nativo: N=131072, r=8, p=1, sal aleatoria de 16 bytes, derivación de 64 bytes, maxmem 192 MiB. Formato versionado `scrypt$v1$N$r$p$saltHex$hashHex`. No se aceptan parámetros arbitrarios al verificar; timingSafeEqual para comparar. Usuarios inexistentes con contraseña de longitud válida realizan derivación ficticia. El hash cuesta aproximadamente 128 MiB de memoria de trabajo por operación; máximo dos derivaciones activas en el módulo, sin reducir parámetros para pruebas.

User.passwordHash es nullable para preservar cuentas antiguas sin contraseña; esas cuentas no acceden por Credentials. Migración detecta correos anteriores sin normalizar y falla en lugar de renombrarlos. Registro usa creación anidada User/Cart atómica; correo único resuelve carreras sin duplicar cuentas. El hash se calcula antes de adquirir la transacción de creación.

## Auth.js/NextAuth

GET/POST `/api/auth/[...nextauth]` conserva protocolo, cookies, CSRF y redirects de la biblioteca. No hay API paralela de tokens ni adaptador de persistencia Auth.js.

Flujo para clientes futuros:

1. GET `/api/auth/csrf`, conservar cookie y csrfToken.
2. POST `/api/auth/callback/credentials` como application/x-www-form-urlencoded con email, password, csrfToken, callbackUrl local y json=true; enviar Origin canónico.
3. Conservar cookie de sesión y consultar GET `/api/auth/session` o la API del carrito.
4. Para logout, obtener CSRF vigente y POST `/api/auth/signout` con csrfToken, callbackUrl local y json=true.

Credentials inválidas devuelven 401 con URL de error del protocolo. Rate limit previo al callback devuelve 429, Retry-After y URL RateLimited compatible con el cliente NextAuth; no romper ese formato reemplazándolo por nuestro contrato REST. Auth.js puede normalizar otros errores de authorize como fallos de acceso; no atribuir todas las respuestas 401 exclusivamente a contraseña incorrecta.

JWT cifrado por la biblioteca, duración ocho horas según política de emisión/renovación NextAuth; cookies HttpOnly, SameSite=Lax y Secure con origen HTTPS (sin Secure para HTTP loopback local). Sesión pública: id/nombre/correo, nunca hash. getServerSession se ejecuta en servidor y la API privada verifica también que User exista en PostgreSQL. Logout borra cookie actual; sin tabla de sesiones no hay revocación global inmediata de un token copiado.

Límites básicos por instancia: hasta 10 intentos por identidad/15 minutos; techo global de 100 login o 30 registro/15 minutos; máximo 5.000 entradas con expiración. Claves derivadas del correo y secreto, no registradas. No es un límite distribuido entre procesos ni un sistema antiabuso de producción. No se deshabilita para las pruebas; los tests usan identidades ficticias y observan 429. Autenticación y mutaciones rechazan origen no canónico; retornos externos se sustituyen por retorno local seguro.

## Carrito propio

La identidad siempre sale de la sesión validada. No aceptar userId/cartId del cliente; no hay endpoint para leer otro carrito. Usuarios sin sesión: 401 JSON. `/carrito` redirige a `/iniciar-sesion` con retorno local. Los recursos de otro usuario no se pueden direccionar por ID de carrito o línea: los ítems se resuelven como productId dentro del carrito propio.

| Método/ruta | Entrada | Éxito |
| --- | --- | --- |
| GET `/api/v1/cart` | Sin parámetros | 200 data y ETag de versión |
| POST `/api/v1/cart/items` | JSON productId, quantity; If-Match | 201 carrito actualizado |
| PATCH `/api/v1/cart/items/[productId]` | JSON quantity; If-Match | 200 carrito actualizado |
| DELETE `/api/v1/cart/items/[productId]` | If-Match | 200 carrito actualizado |

Respuesta data: version, currency=CLP, totalClp e items con productId, slug, name, imagePath, imageAlt, unitPriceClp, quantity, subtotalClp, availableStock, active, available y warning. Subtotales y total se calculan desde precios vigentes del catálogo, no desde datos enviados por cliente.

Cantidad entera 1..99 y suma final <=stock/99. Agregar incrementa una línea existente; PATCH establece cantidad absoluta; cero requiere usar DELETE. Productos inactivos/inexistentes: 404 PRODUCT_NOT_FOUND; ítem ausente en el carrito propio: 404 ITEM_NOT_FOUND. Cantidad inválida: 400 INVALID_QUANTITY. Precio/userId/campos extra se rechazan, no alteran el cálculo.

No se reserva ni descuenta stock. GET conserva líneas que dejan de estar disponibles y muestra advertencia/precio actual, sin borrarlas. Total informativo: no constituye una compra. Sin carrito anónimo, localStorage, fusión de cuentas o checkout.

## Concurrencia

GET expone version y ETag `"N"`; enviar ese valor en If-Match. La versión identifica las escrituras del carrito, no constituye una reserva de stock ni congela los precios externos del catálogo. No usar este ETag para cachear el total; todas las respuestas son no-store y checkout futuro debe revalidar precios/stock.

Transacción ReadCommitted: localizar/crear carrito propio, UPDATE Cart condicional por id/userId/version e incremento, validar producto/stock y modificar ítems. El UPDATE obtiene bloqueo de fila; PostgreSQL reevalúa la condición tras esperar otra escritura. No separar la comprobación de versión y la escritura. Fallos hacen rollback de ítem y versión. No se tocan filas Product.

409 CART_CONFLICT para versión desactualizada o carrera de creación; 409 STOCK_CONFLICT para disponibilidad/cantidad final incompatible; 428 VERSION_REQUIRED si falta If-Match; 400 formato de versión inválido. Una pareja concurrente con la misma versión produce una escritura ganadora y otra 409; no reintentar automáticamente incrementos. La interfaz recupera GET cart y explica el conflicto, conservando el resultado confirmado en servidor. Timeout de transacción 10 s, espera máxima 5 s, sin bucle ilimitado de reintentos.

GET usa snapshot RepeatableRead para su lectura; mutaciones usan ReadCommitted y control de versión. Entre solicitudes distintas pueden cambiar precios/stock. No se presenta ese carrito como una reserva comercial.

## Instrumentación y privacidad

Helper compartido para catálogo, registro, Auth.js y carrito: logs JSON con route normalizada, method, requestId, estado, totalMs, dbMs, authMs y hashMs. AsyncLocalStorage nativo correlaciona las mediciones sin pasarlas por todos los callbacks. La respuesta original de Auth.js conserva Set-Cookie/redirects; se añaden no-store, requestId y Server-Timing.

totalMs abarca handler y preparación de respuesta, no toda la red; dbMs incluye driver/pool/operación Prisma. authMs puede incluir dbMs/hashMs, de modo que las métricas no se deben sumar como fases excluyentes. Logger de biblioteca solo emite códigos, nunca metadatos de error con credenciales.

No registrar contraseñas, hashes, tokens, cookies, CSRF, correo, cuerpos de requests ni URLs completas con parámetros. La prueba de reinicio captura stdout/stderr y comprueba que sus secretos conocidos no aparecen. No se añade servicio externo ni tablas de logs.
