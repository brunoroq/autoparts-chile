# Procedimiento pendiente: migración del carrito de invitados en Neon

Este documento es un plan, no una autorización de ejecución. El usuario autoriza únicamente el commit local. Verificación remota, respaldo, migración, push y despliegue deben contar con autorización para cada operación. No se consultó Neon para redactarlo.

Actualización de 2026-11-06: autorizado el commit local de la corrección de origen y preparar este procedimiento; no ejecutar el respaldo ni la migración. La lectura remota del diagnóstico anterior confirmó seis migraciones completas, ausencia de CartMergeReceipt y User.id UUID. No se volvió a consultar producción en este cierre. La migración ya está versionada en `040dd8215ca76265b448525865e70207cb6c9191`; el commit de corrección de origen no modifica su SQL.

## Compatibilidad con el despliegue actual

La corrección de origen conserva rutas, cuerpos, respuestas, sesiones y controles del carrito desplegado. No necesita otro esquema ni versiones nuevas de dependencias. Requiere corregir NEXTAUTH_URL Production a `https://autoparts-chile.vercel.app`; publicar solo el código con el dominio antiguo configurado seguirá devolviendo 403. Host y X-Forwarded-Host presentes deben coincidir con ese host, conforme al proxy de Vercel; no se habilitan aliases o previews automáticamente.

La migración aditiva es compatible tanto con la aplicación anterior al carrito invitado como con la versión que ya incorpora el carrito. El despliegue actual con carrito invitado necesita esa tabla para fusionar: su ausencia es un problema preexistente, separado del origen. Mantener una ventana sin operaciones de fusión durante la migración/verificación evita escrituras nuevas mientras se revisa. No afirmar que la tabla estará vacía si la aplicación activa ya pudo procesar fusiones después de crearla.

## Contenido y compatibilidad

`20261106010000_guest_cart_merge/migration.sql` crea `CartMergeReceipt` con `id` UUID como clave primaria, `userId` UUID, `requestHash` VARCHAR(64), `createdAt` TIMESTAMPTZ(3), índice de `userId` y FK a `User(id)`. ON DELETE CASCADE elimina comprobantes solo si posteriormente se elimina su usuario; aplicar la migración no elimina ningún usuario ni registro existente.

Es aditiva: no cambia columnas existentes ni ejecuta operaciones de datos sobre productos, stock, usuarios, carritos, pedidos o pagos. Las seis migraciones anteriores se conservan. Con el esquema conocido de Neon, `User(id)` ya es UUID/PK: los datos actuales son compatibles porque la tabla nueva empieza vacía. Esta es una conclusión por inspección del código y las verificaciones remotas anteriores, no una certificación del estado actual de producción. Debe confirmarse antes de ejecutar.

La versión anterior de la aplicación puede seguir usando sus ocho tablas mientras existe esta tabla adicional. El cambio inverso requiere orden: la versión nueva necesita la nueva tabla para fusionar; no desplegarla antes de migrar. No borrar la tabla al revertir un despliegue: preserva la idempotencia y permite volver a la aplicación anterior sin revertir datos. La creación de la FK puede tomar un bloqueo breve sobre User; elegir baja actividad y no prometer ausencia total de bloqueo.

## 1. Revisión previa, después de autorizar lectura remota

- Confirmar en el panel proyecto `autoparts-chile-public`, rama `production` y base `neondb`. El hostname por sí solo no demuestra el nombre del proyecto o rama.
- Validar privadamente DIRECT_URL directa y DATABASE_URL pooled del mismo endpoint/base, región São Paulo y TLS verify-full. No modificar `.env` de Docker ni copiar conexiones al chat, Git o capturas.
- Verificar SELECT current_database(), esquema public, existencia/tipo/PK de User.id y ausencia de CartMergeReceipt. Revisar también el esquema de las ocho tablas contra el esperado: migrate deploy no detecta drift por sí mismo.
- Revisar `_prisma_migrations`: las seis conocidas terminadas, sin fallos/rollback y checksums iguales a los archivos versionados. La única pendiente debe ser `20261106010000_guest_cart_merge`. Si hay otra pendiente, cambios de esquema, tabla parcialmente creada o fallos, detenerse.
- Revisar permisos del rol administrativo para CREATE e REFERENCES sobre User y permisos runtime previstos sobre la tabla nueva. Con roles separados, no asumir que los grants de tablas antiguas se heredan: verificar privilegios predeterminados o preparar GRANT específicos para autorización separada.
- Capturar conteos/huellas privadas de las ocho tablas y el historial. Para comparaciones exactas, coordinar una pausa de escrituras de usuarios durante respaldo/migración/verificación; de otro modo diferencias pueden provenir del uso legítimo de la tienda.

## 2. Respaldo, con autorización específica

Usar `pg_dump` de versión compatible con PostgreSQL remoto, conexión directa (no pooled), certificado verificado y formato custom (`--format=custom`). Pasar la configuración mediante variables PG* privadas o un archivo de servicio y contraseña protegido; no incluir la contraseña ni la URI completa como argumento visible. Mantener las credenciales administrativas fuera de Vercel y del repositorio.

Guardar el dump fuera del repositorio, con acceso restringido y cifrado cuando corresponda: puede contener cuentas, hashes y pedidos. Registrar fecha, base, versión y SHA-256 del archivo sin publicar datos. `pg_restore --list` verifica que el archivo se puede leer, pero no prueba por sí solo que sea restaurable. Comprobar una restauración en una base nueva aislada y autorizada (por ejemplo una local `_test`), nunca sobre la base Docker habitual ni production. Comparar esquema y conteos. No continuar si el respaldo/restauración de ensayo falla.

Si se elige además una rama/capacidad de recuperación de Neon, revisar disponibilidad, retención y límites reales del plan antes de crearla. No asumir que la ventana gratuita es ilimitada ni crear recursos de pago. Crear ramas o restaurarlas también requiere autorización; este commit no realiza esas operaciones.

## 3. Aplicación, únicamente después de autorizar la migración

Usar el commit auditado y dependencias del lockfile. Confirmar que no apareció ninguna migración adicional desde la revisión. El script cloud aplica todas las pendientes, no un nombre seleccionado.

La simulación existente valida argumentos/configuración sin conectarse; no sustituye las comprobaciones de lectura anteriores:

```powershell
npm run cloud:migrate -- --env-file .env.neon.local --confirm-target "$destinoNeon"
```

`$destinoNeon` debe contener exclusivamente el hostname directo confirmado seguido de `/neondb`, sin usuario, contraseña ni URI. Después de completar respaldo y revisiones, y solo con autorización explícita:

```powershell
npm run cloud:migrate -- --env-file .env.neon.local --confirm-target "$destinoNeon" --execute
```

El script utiliza DIRECT_URL exclusiva del archivo privado, verifica destino/TLS/base y ejecuta Prisma 7 `migrate deploy`. No usar migrate dev, reset, db push, seed ni bootstrap. No ejecutar migraciones desde build ni endpoints públicos. Ante error, detenerse sin borrar objetos ni marcar migraciones como resueltas automáticamente: podría haber DDL parcialmente aplicado y se debe revisar.

## 4. Comprobación posterior y publicación separada

- Mediante SELECT verificar siete migraciones terminadas y checksum correcto de la nueva; revisar nueve tablas de aplicación (antes ocho), columnas, índice, PK y FK nuevos.
- Confirmar ausencia de referencias huérfanas. Bajo pausa de escrituras y sin fusiones ejecutadas, la tabla nueva debe estar vacía; si la aplicación ya está activa, comprobar y explicar los registros legítimos sin borrarlos. Comparar las ocho tablas originales con las huellas previas si se mantuvo pausa de escrituras; si no, explicar cambios legítimos antes de concluir.
- Verificar permisos del rol pooled sobre la tabla nueva. La lectura sola no prueba permisos de INSERT: consultar has_table_privilege sin crear registros de prueba en producción.
- Comprobar con pocas lecturas que la aplicación anterior sigue mostrando catálogo y las rutas públicas; pruebas funcionales que escriban pedidos/cuentas requieren autorización aparte.
- Informar resultados y detenerse. Push y despliegue Vercel siguen requiriendo autorizaciones separadas. Un push a un repositorio conectado puede activar un despliegue automático: confirmar esa configuración antes de autorizarlo.
- Después de autorizar publicación, usar el cliente Prisma generado por el build y realizar pocas pruebas manuales de invitado → login/registro → fusión → checkout simulado. Sin carga ni pagos externos.

Si la nueva aplicación falla, se puede volver al despliegue anterior conservando la tabla aditiva y sus comprobantes. Restaurar un dump sobre production puede perder escrituras posteriores al respaldo: no hacerlo como rollback rutinario ni sin nueva aprobación y revisión.

Fuentes oficiales: [respaldo Neon con pg_dump](https://neon.com/docs/manage/backup-pg-dump), [Prisma CLI v7 migrate deploy y límites](https://www.prisma.io/docs/cli/v7/migrate/deploy).
