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

No hay datos semilla en esta etapa. Catálogos de distintos tamaños quedan para la etapa 2.
