# Preparación de publicación: Vercel Hobby y Neon Free

Prompt 015 autoriza preparar código, herramientas y documentación. **No autoriza ejecutar migraciones/bootstrap en Neon, crear commits, push ni despliegue.** La base habitual Docker se conserva. La implementación de etapa 5 continúa pendiente de commit y de comprobación con una propiedad real de Google. Webpay oficial también mantiene su comprobación manual pendiente; esta primera publicación solo admite simulador.

## Compatibilidad y límites de ejecución

Stack conservado: Next.js 16.4.5, Prisma/adapter-pg 7.10.1, pg 8.23.1 y NextAuth 4.24.15. Node fijado a 24.x en engines; npm 11 y lockfile existentes, sin dependencias nuevas ni actualizaciones forzadas. Vercel selecciona el patch de Node disponible; se verificará durante el primer build remoto. No se utiliza Edge: layout raíz y todos los Route Handlers declaran nodejs. Scrypt, JWT/cookies, AsyncLocalStorage y transacciones siguen en Node.

El cliente Prisma se reutiliza por instancia, incluyendo producción. Pool por defecto: 5 conexiones localmente; 2 cuando VERCEL=1. DB_POOL_MAX admite 1–5 en Vercel y 1–10 localmente. DB_CONNECT_TIMEOUT_MS: 10000 en Vercel, 5000 local; DB_IDLE_TIMEOUT_MS: 10000. Ninguno es un límite global entre funciones. Pool permite salir cuando queda inactivo; no se desconecta después de cada request. Se habilita channel binding cuando corresponde y se mantiene verificación de certificados.

En Vercel la conexión runtime debe ser Neon pooled, hostname ep-...-pooler....neon.tech, TLS y secreto de sesión válido. NEXTAUTH_URL debe ser un origen HTTPS sin rutas/queries/credenciales. La validación falla con mensajes seguros si falta configuración. Los defaults actuales de NextAuth conservan cookies seguras para HTTPS y CSRF; no se agrega dominio wildcard ni se relaja Origin. Compartir siempre la URL canónica estable, no una URL efímera de otro deploy: aliases diferentes no comparten sesión/origen automáticamente.

PAYMENT_PROVIDER solo puede ser simulated en Vercel; el adaptador Webpay se bloquea allí incluso si existiera un intento antiguo externo. Localmente se conserva el ambiente de integración autorizado de etapa 4. No hay pagos de producción ni API secrets de Transbank.

El monitor Node/PostgreSQL con timer no arranca en Vercel, incluso si RESOURCE_METRICS_ENABLED=true por error. Se conserva stdout por petición, Server-Timing y errores saneados. Docker y exportación de archivos son herramientas locales; no se ejecutan dentro de funciones. CPU/memoria de contenedores locales no se presentan como recursos de Vercel/Neon. No se escriben reportes persistentes en el filesystem serverless ni se agregan cron jobs.

## Variables Production en Vercel, configuración futura

| Variable | Valor inicial |
| --- | --- |
| DATABASE_URL | Conexión Neon pooled de la aplicación, TLS |
| NEXTAUTH_URL | https://DOMINIO-ESTABLE.vercel.app |
| NEXTAUTH_SECRET | Secreto aleatorio nuevo, exclusivo del entorno público, >=32 caracteres |
| PAYMENT_PROVIDER | simulated |
| WEBPAY_ENVIRONMENT | integration, sin activar el adaptador |
| DB_POOL_MAX | 2 |
| DB_CONNECT_TIMEOUT_MS | 10000 |
| DB_IDLE_TIMEOUT_MS | 10000 |
| RESOURCE_METRICS_ENABLED | false (también bloqueado por código) |
| ANALYTICS_ENABLED | false |
| GA4_MEASUREMENT_ID / GA4_SYNTHETIC_MEASUREMENT_ID | Sin definir inicialmente |
| GA4_DEBUG | false |
| WEB_VITALS_ENABLED | false inicialmente |
| APP_ENV | vercel-production |
| TRAFFIC_KIND | human |
| EXPERIMENT_ID | UUID o identificador nuevo de la publicación |
| CATALOG_SIZE | 30 |
| EXPERIMENT_CONCURRENCY | unspecified |

VERCEL/VERCEL_ENV son suministradas por la plataforma; no definir VERCEL en el .env de Docker. No usar NEXT_PUBLIC_ para credenciales. PAYMENT_TOKEN_SECRET no es necesario en el simulador. DIRECT_URL es administrativa y no se necesita para generar Prisma durante build: no agregar el secreto administrativo al runtime público por conveniencia. Producción y previews no deben compartir credenciales; un preview funcional requiere su propia base y URL canónica. No configurar previews funcionales en esta preparación.

Para generar NEXTAUTH_SECRET localmente puede usarse `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`; guardarlo solo en los campos privados de Vercel. No copiar su salida al chat, Git, capturas o informes.

## Configuración manual de Neon, pendiente

1. Tras la revisión del usuario, crear un proyecto nuevo Free para la tienda pública, separado completamente de Docker. Elegir PostgreSQL 17 si está disponible y región cercana a la región elegida de Vercel. Registrar región/versión/límites para el informe.
2. Crear/seleccionar una base vacía, por ejemplo autoparts_public, y confirmar proyecto, rama, endpoint y base en la consola. No importar cuentas, hashes, pedidos ni carritos de Docker.
3. Copiar conexión pooled para la aplicación y directa para administración. Preferir un rol runtime con permisos de datos y otro administrativo para DDL cuando se configuren los permisos; verificar los grants necesarios antes de publicar. No inventar ni imprimir credenciales.
4. Conservar la conexión administrativa solo en un archivo privado llamado `.env.neon.local`, que ya está cubierto por .gitignore. Contenido: DIRECT_URL con la URL directa proporcionada por Neon. No se creó ese archivo con datos reales en este turno.
5. Comparar el hostname/base con la consola de Neon, no solo con el propio archivo. El hostname debe ser Neon ep-..., sin -pooler para administración. Usar TLS con sslmode=require o verify-full; los scripts normalizan a verify-full. Se admiten channel_binding=require y schema=public, sin parámetros de host/rol/search_path que cambien el destino.

## Scripts cloud y controles antes de escribir

Ambos comandos son **simulación por defecto**, sin conexiones de red:

```powershell
npm run cloud:migrate -- --env-file .env.neon.local --confirm-target ep-ENDPOINT.REGION.aws.neon.tech/autoparts_public
npm run cloud:bootstrap -- --env-file .env.neon.local --confirm-target ep-ENDPOINT.REGION.aws.neon.tech/autoparts_public
```

Sustituir el destino por el real solo después de crear Neon. Estos comandos todavía no prueban acceso ni existencia de tablas. El modo de ejecución requiere añadir explícitamente `--execute` **después de una nueva autorización**. No se usó ese modo contra Neon en esta preparación.

Controles: argumentos estrictos; archivo exclusivo distinto de .env; DIRECT_URL obligatoria en ese archivo, sin fallback a DATABASE_URL del entorno; protocolo PostgreSQL; endpoint Neon y puerto esperado; credenciales presentes; TLS; parámetros admitidos sin duplicados; conexión directa y confirmación exacta host/base. Se rechazan localhost, sufijos engañosos, pooler administrativo y alteraciones de host/options/schema. Antes de una escritura autorizada, se establece TLS y se consulta current_database() para comprobar coincidencia. La confirmación de proyecto/rama en la consola sigue siendo responsabilidad del operador: PostgreSQL no identifica el proyecto del panel de Neon por sí mismo.

El comando de migración ejecuta exclusivamente `prisma migrate deploy`, por proceso hijo sin shell, con DATABASE_URL y DIRECT_URL apuntando al destino validado. No usa migrate dev, db push, reset ni un seed implícito. Su salida arbitraria no se vuelca para evitar filtrar conexiones; ante fallo se revisarán permisos/estado cuidadosamente, sin publicar secretos. El archivo Prisma mantiene fallback a DATABASE_URL para trabajo local y generación; los scripts de prueba pasan explícitamente la URL local aislada como DIRECT_URL para evitar cruces.

El bootstrap reutiliza exactamente el catálogo determinista de seis categorías y 30 productos. En una transacción valida conflictos ID/SKU/slug y usa solo createMany(skipDuplicates). No actualiza nombres, precios, stock, categorías existentes, usuarios, carritos, pedidos ni pagos. Se puede repetir sin reponer existencias ni duplicar productos; registros ajenos no se borran. Identidades incompatibles detienen el proceso sin escrituras parciales. No usar el seed general para inicializar repetidamente una tienda con compras: ese seed puede actualizar existencias. No ejecutar bootstrap ni migraciones desde build, postinstall, previews o endpoints públicos.

## Preparación de Vercel, pendiente de publicación

Framework Preset Next.js, raíz del repositorio, Node 24.x, Install Command npm ci, Build Command npm run build y Output Directory automático. El build ya genera el cliente Prisma ignorado por Git; no conecta para migrar ni cargar productos. No se usa npm start como servidor permanente ni Docker Compose en Vercel. No hizo falta vercel.json: seleccionar una única región en el panel, coordinada con Neon, en vez de fijar una región arbitraria antes de crear la base.

Tras futuras autorizaciones: preparar los dos commits separados, auditar sus secretos/archivos, comprobar pruebas y solo entonces publicar en GitHub. Si Vercel ya tiene el repositorio conectado, un push puede activar despliegues automáticos: no hacer un push intermedio del commit de etapa 5. Verificar ambos commits y el hash final seleccionado antes de Deploy. Primero aplicar migraciones y bootstrap autorizados a Neon, luego configurar Production y publicar. No se ejecutó ninguno de estos pasos externos.

La primera revisión pública será de pocas operaciones manuales: catálogo/filtros/detalle/imágenes; registro y login/logout; cookies Secure/HttpOnly/SameSite y CSRF; carrito/versiones; compra simulada/historial/stock; aislamiento de dos usuarios; persistencia tras logout y redeploy. Verificar que no queden localhost, datos personales en logs ni accesos de preview indebidos. No se ejecutarán suites de escritura automáticamente sobre producción. Un rollback de Vercel no revierte la base: futuras migraciones se revisan como cambios aditivos y con respaldo.

## Costos, seguridad y observabilidad

Mantener Hobby/Free, sin upgrades, cron, warming continuo, servicios de métricas o complementos de pago. Revisar Usage/alertas de ambos paneles y límites vigentes antes de compartir la URL. Scrypt consume CPU y tiene límite local de dos derivaciones activas; los limitadores en memoria no son distribuidos ni sobreviven a reinicios. Configurar las protecciones gratuitas disponibles de Vercel sin prometer inmunidad a abuso. Usar cuentas de demostración sin contraseñas reutilizadas y evitar datos personales innecesarios.

No habrá carga o estrés contra Vercel, ni scripts k6. Latencias de cold start, suspensión de Neon, red, cuotas y logs de retención limitada se documentarán como diferencias respecto de Docker local. GA4 permanece apagado hasta configurar el ID, comprobar consentimiento y revisar medición mejorada según [etapa 5](stage-5.md). No conceder acceso al profesor sin autorización separada.

Fuentes: [Vercel Node](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [funciones y límites](https://vercel.com/docs/functions/limitations), [Hobby](https://vercel.com/docs/plans/hobby), [Neon/Prisma](https://neon.com/docs/guides/prisma), [Neon Free](https://neon.com/pricing), [NextAuth](https://next-auth.js.org/configuration/options). Las condiciones del panel deberán verificarse de nuevo al publicar. La compatibilidad remota, DNS, TLS y permisos reales quedan pendientes hasta crear y probar Neon/Vercel.
