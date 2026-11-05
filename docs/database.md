# Base de datos inicial

PostgreSQL 17.11 en Docker Compose, servicio `postgres`, volumen `postgres_data`. La aplicación corre en el host. El puerto se publica exclusivamente en `127.0.0.1`. Los datos sobreviven a `docker compose down`; no usar `down -v` sin autorizar el borrado.

## Modelo provisional

| Modelo | Propósito y restricciones |
| --- | --- |
| User | UUID, correo único, nombre opcional y fechas. Sin autenticación implementada. |
| Category | Nombre y slug único. |
| Product | SKU/slug únicos, descripción, categoría, precio CLP entero, stock y actividad. |
| Cart | Un carrito por usuario mediante relación única; carrito anónimo pendiente de diseño. |
| CartItem | Producto y cantidad, únicos por carrito/producto. |
| Order | Usuario, total, estado e idempotencyKey único; historial indexado por usuario/fecha. |
| OrderItem | Copia de nombre y precio comprado, cantidad y referencia al producto. |
| PaymentAttempt | Pedido, proveedor, monto, estado y referencia externa opcional única. Sin integración. |

Estados iniciales: pedido PENDING/PAID/CANCELLED; pago PENDING/APPROVED/REJECTED/CANCELLED. Proveedores representados: SIMULATED/WEBPAY_INTEGRATION. Son valores del esquema, no servicios habilitados. Las transiciones y reservas de stock se definirán al implementar compra.

Los productos con referencias históricas no se eliminan: las claves foráneas restringen su borrado; el campo `active` permite retirarlos del futuro catálogo. El borrado de usuario con pedidos también se restringe. Carrito e ítems transitorios sí se eliminan en cascada.

La migración inicial incorpora CHECK de cantidades positivas y precios, stock y montos no negativos. Los CHECK se mantienen en SQL porque Prisma no los representa en el esquema. La coherencia entre total y líneas se implementará transaccionalmente al construir checkout. La normalización del correo se resolverá con el registro de usuarios.

## Conexión y comandos

Copiar `.env.example` a `.env`, elegir contraseña local y mantener `DATABASE_URL` sincronizada. Usar contraseña codificada para URL si contiene caracteres especiales. Nunca versionar `.env`.

```powershell
npm run db:up
npm run db:generate
npm run db:deploy
npm run db:check
npm run db:status
```

`db:deploy` aplica migraciones existentes, también localmente; no despliega la aplicación. Para cambios de esquema aprobados: `npm run db:migrate -- --name nombre_del_cambio`. Revisar el SQL antes de aplicarlo. No usar `db push` como sustituto de migraciones versionadas.

`db:check` ejecuta SELECT 1 y cuenta los ocho modelos sin insertar registros; devuelve error si conexión, tablas o consultas fallan. El pool utiliza máximo cinco conexiones y timeout inicial de cinco segundos. Reutiliza cliente durante recarga de desarrollo y se desconecta al finalizar el script.

## Catálogo y seed (etapa 2)

Migración `20261104235500_catalog_images` agrega imagePath e imageAlt con valores de fallback compatibles con filas existentes. Las migraciones anteriores no se modificaron.

```powershell
npm run db:deploy
npm run db:generate
npm run db:seed -- --size 30
```

El dataset `autoparts-v1` tiene seis categorías y 30 productos base. Acepta exactamente 30, 1000 o 10000. IDs UUID derivados de SHA-256, SKU, slug, precios y stock son deterministas. Los adicionales son variantes sintéticas identificadas; cinco productos de cada categoría por ciclo de 30, con diferencia máxima de cinco al truncar. Versionar la semilla fija dentro del generador, no depender de Math.random.

Repetir el mismo tamaño hace upsert sin duplicar. Las fechas técnicas de actualización pueden cambiar al ejecutar upsert; la reproducibilidad se refiere al contenido del dataset. El seed actualiza los campos de los productos propios del dataset: ejecutarlo solo en bases de demostración/evaluación. Si detecta productos/categorías ajenos o un catálogo mayor que el tamaño solicitado, aborta antes de escribir. No elimina filas, pedidos ni datos de usuario. No ejecutar seeds concurrentes ni como parte del build.

## Base aislada para verificaciones y futura evaluación

`npm run test:prepare` crea, si no existe, `autoparts_catalog_test` en el mismo PostgreSQL local y aplica migraciones. No resetea ni borra datos. `npm run test:integration` escribe únicamente allí; verifica 30/1000/10000, idempotencia, consultas y rechazo de reducción. Una repetición conserva el catálogo grande; el test adapta sus expectativas. La base habitual `autoparts` mantiene 30 productos.

Para una base aislada con otro nombre, definir `TEST_DATABASE_URL` (misma estructura que DATABASE_URL, nombre local terminado en `_test`) en `.env` local, manteniendo la conexión administrativa DATABASE_URL también local. No imprimir URLs con contraseña ni incorporarlas al repositorio.

Para preparar un tamaño concreto sin tocar `autoparts`, abrir una terminal aparte:

```powershell
# En .env local: TEST_DATABASE_URL apunta a una nueva base, por ejemplo autoparts_perf_1000_test.
npm run test:prepare
# El comando siguiente utiliza exclusivamente la conexión aislada, sin imprimirla:
npm run db:seed:test -- --size 1000
```

Usar otra base vacía para reducir tamaños, sin truncar. Para ejecutar la aplicación sobre esa base, cambiar DATABASE_URL únicamente en una configuración local aislada y reiniciar el servidor; no modificar el entorno de la tienda habitual durante las verificaciones. Estas instrucciones preparan datos: no ejecutan pruebas de carga. El permiso para crear bases requiere un rol local adecuado, como el usuario creado por Compose; no se añaden roles ni servicios.

## Usuarios y carrito (etapa 3)

Migración `20261105011000_users_cart`: User.passwordHash nullable, Cart.version default 0, CHECK de versión no negativa y máximo de 99 en CartItem.quantity. Detecta correos previos sin normalizar y detiene la migración en lugar de modificarlos. Se conservan tablas y productos existentes. Registro crea usuario y carrito atómicamente; no hay tablas Account/Session/VerificationToken porque Credentials utiliza JWT y persistencia propia.

El hash se conserva exclusivamente en User y nunca se selecciona para respuestas o carritos. Las mutaciones de carrito condicionan por propietario/versión dentro de una transacción ReadCommitted. Consultar [contratos de autenticación y carrito](api/auth-cart.md) para identidad, If-Match y rollback. Ninguna operación del carrito escribe en Product ni reserva stock.

`npm run test:auth:prepare` crea/migra `autoparts_auth_test` y carga 30 productos, sin borrar datos. Puede usarse AUTH_TEST_DATABASE_URL local terminada en `_test` para otro destino aislado. Los tests generan usuarios únicos, contraseñas en memoria y carritos ficticios; se conservan para inspección, sin tareas automáticas de borrado. `autoparts_catalog_test` conserva sus 10.000 productos y es independiente.

La tienda habitual sigue en `autoparts`, sin usuarios de prueba predefinidos. No se incluye una contraseña de administrador ni se agrega autenticación al seed de productos. Cualquier limpieza de bases/cuentas requiere autorización específica.

## Actualización de etapa 4

Migración aditiva 20261105030000_checkout, aplicada sin reset. Estados indeterminados/reversa/revisión; versión y referencia del carrito; fingerprint e idempotencia compuesta por usuario; reclamaciones persistentes y referencias de pago. Token cifrado AES-GCM y hash SHA-256 único, nunca datos de tarjeta. Índice por carrito/estado para pedidos pendientes. Se conservan restricciones monetarias y cantidades. Ver [reglas transaccionales](stage-4.md).
