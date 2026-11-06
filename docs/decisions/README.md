# Registro de decisiones técnicas

Registrar decisiones importantes con fecha, estado, contexto, decisión y consecuencias. Una tabla basta mientras el proyecto sea pequeño; crear documentos separados solo si una decisión requiere más detalle. Las propuestas pendientes no equivalen a implementaciones aprobadas.

| ID y fecha | Estado | Contexto y decisión | Consecuencias |
| --- | --- | --- | --- |
| D001 - 2026-11-04 | Aprobada | Usar un monolito modular Next.js y PostgreSQL; priorizar medición y simplicidad | Servicios compartidos; sin microservicios ni capas vacías |
| D002 - 2026-11-04 | Aprobada | Mantener el stack indicado por el usuario; verificar versiones al inicializar | Sin instalaciones ni versiones arbitrarias en etapa 0 |
| D003 - 2026-11-04 | Aprobada | Separar Webpay de integración y simulador mediante un proveedor de pagos | Carga masiva solo simulada; mismas reglas de negocio y persistencia |
| D004 - 2026-11-04 | Aprobada | Usar catálogos reproducibles de 30, 1.000 y 10.000 productos | Comparar consultas con distribución y semilla registradas |
| D005 - 2026-11-04 | Propuesta para etapa 1 | Usar Docker Compose para PostgreSQL; contenerizar la app solo si resulta conveniente | Reproducción local sencilla; no se crea infraestructura todavía |
| D006 - 2026-11-04 | Aprobada | Evaluar local y cloud gratuito como infraestructuras distintas | Registrar cuotas, topología y recursos; no atribuir toda diferencia al código |
| D007 - 2026-11-04 | Aprobada | Separar carga HTTP, experiencia del navegador y métricas de infraestructura | GA4 no reemplaza k6 ni mediciones de recursos |
| D008 - 2026-11-04 | Aprobada | Línea base con consultas reales; optimizar después de medir | Caché e índices se estudian con configuración documentada |
| D009 - 2026-11-04 | Aprobada | Mantener interfaz moderna con funciones acotadas | Diseño adaptable y claro; sin paneles ni flujos comerciales innecesarios |
| D010 - 2026-11-04 | Aprobada | Etapa 0 exclusivamente documental y autorización por etapa | Etapa 1, commit y despliegue pendientes de autorización |

No hay resultados de desempeño medidos ni proveedor cloud seleccionado.

## Actualizaciones de etapa 1 - 2026-11-04

- D005 implementada: PostgreSQL en Compose; Next.js en host, sin contenedor adicional. Imagen `postgres:17.11-bookworm`, volumen persistente y publicación solo en localhost.
- D010 actualizada: commit de etapa 0 `adbfa0e`. Plan concreto de etapa 1 aprobado por el usuario y ejecutado; etapa 2 requiere aprobación. Sin despliegue.
- D011: versiones exactas de dependencias directas y npm con lockfile. Prisma 7.10.1 estable en lugar de 8 candidata; TypeScript 5.9.3 y ESLint 9.39.5 según plan aprobado. Revisar soporte de ESLint antes de mantenerlo a largo plazo; npm lo marca fuera de soporte.
- D012: generador `prisma-client` con salida ignorada en `src/generated/prisma`, adaptador `@prisma/adapter-pg`, pool de cinco conexiones y cliente reutilizado en desarrollo. Configuración de CLI en `prisma.config.ts` con dotenv.
- D013: ocho tablas iniciales; carrito vinculado a usuario, sin resolver flujo anónimo. No crear tablas Auth.js hasta decidir autenticación. CHECK en segunda migración SQL para montos, stock y cantidades; no añadir índices de optimización antes de medir, salvo claves y relaciones básicas.
- D014: página provisional estática deliberadamente aislada de PostgreSQL; conexión real mediante script de integración sin endpoint público. Las páginas de catálogo posteriores sí consultarán PostgreSQL.
- D015: ocho avisos moderados transitivos en herramientas de lint, cero en auditoría de producción. Mantener versiones aprobadas; no usar `npm audit fix --force`, que propone degradar la configuración Next a otra versión mayor. Documentar y reevaluar actualización compatible en un cambio posterior.

## Cierre de etapa 1 y planificación de etapa 2 - 2026-11-04

- Commit `4d224a6`: base técnica y documentación. Índice revisado sin credenciales locales, node_modules, código generado ni datos locales PostgreSQL. `next-env.d.ts` ignorado por ser generado por Next.js.
- D016 propuesta: identidad blanca/negra/gris con detalles rojos; seis categorías y 30 productos ficticios. Detalle en [propuesta de catálogo](../stage-2-proposal.md). Pendiente de aprobación, sin implementación.
- D017 evaluación: ESLint 10.14.0 soporta el Node instalado, pero los peers efectivos de React/import/jsx-a11y aún excluyen v10. Dry-run emitió conflictos; no se cambió dependencia ni lockfile. Recomendar posponer actualización hasta compatibilidad completa. No se interpretó el peer amplio de eslint-config-next como prueba suficiente.

## Implementación de etapa 2 - 2026-11-04

- D016 aprobada por prompt 007 e implementada. Blanco/negro/gris/rojo, hero de carretera, seis categorías y 30 productos ficticios. Sin funciones posteriores.
- D017 confirmada por usuario: mantener ESLint 9.39.5. No se actualizó ni se usó force, legacy-peer-deps u overrides.
- D018: una fotografía Unsplash licenciada y 30 ilustraciones originales de producto con fuente SVG y WebP. No usar fotografías comerciales sin permiso ni contratar generación. Hero 191.920 bytes, productos hasta 7.934 bytes. [Procedencia](../images.md).
- D019: conteo y listado en RepeatableRead para snapshot coherente; no garantiza consistencia entre solicitudes distintas. dbMs es tiempo de pared Prisma, totalMs es handler con serialización, no latencia de red. [Contrato](../api/catalog.md).
- D020: base de integración local `autoparts_catalog_test`; pruebas completas de seed hasta 10.000 sin borrar datos, dejando `autoparts` con 30. Upserts en lotes de 100, abortar reducción de tamaño y datos ajenos.
- D021: Playwright 1.64.1 solo en dev para Chrome existente ante CUA indisponible; sin navegador adicional ni dependencias nuevas de producción. Capturas ignoradas por Git. Prettier se ejecutó una vez para formato desde npm sin añadirse al manifiesto.
- D022: filtros con formulario GET y URL reproducible; plegados inicialmente en móvil tras hidratación y abiertos en escritorio. Datos dinámicos sin caché, imágenes con carga diferida y caché documentada. Sin animaciones pesadas ni librerías UI.

## Propuestas de etapa 3 - 2026-11-04 (sin implementación)

- D023 propuesta: next-auth 4.24.15 estable, Credentials, JWT y persistencia User propia con Prisma. Versión 5.0.0-beta.32 es beta; ambas declaran Next 16/React 19 en npm. Confirmar compatibilidad efectiva al implementar, sin force ni degradación de versiones.
- D024 propuesta: scrypt asíncrono de Node (N=2^17, r=8, p=1), sal aleatoria y parámetros versionados; no agregar dependencia nativa de hash. Documentar costo de memoria/CPU y limitar intentos sin relajar el hash para benchmarks.
- D025 propuesta: Cart.version e If-Match con transacciones y actualización condicional para detectar conflictos 409; cantidades 1..99 y stock validado, sin reservarlo en carrito. Precios calculados en servidor, persistencia por usuario, sin carrito anónimo.
- D026 propuesta: extender instrumentación actual a métodos variables, autenticación y hashing; conservar protocolo de cookies/CSRF y respuestas propias de Auth.js. Sin telemetría externa ni datos sensibles en logs.
- Diseño de etapa 2 aprobado visualmente: conservarlo e integrar solo pantallas/acciones necesarias. Propuesta completa en [etapa 3](../stage-3-proposal.md). No hay aprobación de implementación ni commit pendiente.

## Etapa 3 implementada - prompt 009, 2026-11-04

- D023 aprobada y verificada con app aislada real: NextAuth 4.24.15, Next 16.4.5 y React 19.3.1 compatibles; no cambiar stack ni usar beta.
- D024 implementada: scrypt nativo asíncrono, sal 16 bytes, key 64 bytes, N=2^17/r=8/p=1 y formato versionado. Costo y límites documentados; sin biblioteca externa.
- D025 implementada: versión Cart y CAS dentro de transacción ReadCommitted. 409 real de concurrencia, rollback completo y recuperación UI sin repetir incrementos. Precios del servidor, stock sin reserva.
- D026 implementada: AsyncLocalStorage nativo correlaciona db/auth/hash, respuesta NextAuth preservada y logger solo de códigos. Se verificó ausencia de secretos conocidos en logs capturados.
- D027: base `autoparts_auth_test` y servidor 3002 separados del catálogo y de la tienda; usuarios y contraseñas sintéticos por ejecución. Persistencia tras reinicio comprobada en proceso efímero 3104.
- D028: validar origen canónico en JSON y POST de Auth.js, cuerpo acotado, CSRF de biblioteca y retornos locales. Limitador por identidad/global en memoria; sin prometer protección distribuida o revocación global de JWT.
- Diseño mantenido, agregando solo cuenta/carrito. Migración aditiva sin cambiar datos de catálogo. [Verificación](../verification-stage-3.md). Sin autorización de commit, despliegue o etapa 4.

## Cierre conjunto de etapas 2 y 3 - prompt 010

Commit descriptivo autorizado con auditoría de índice y verificaciones actualizadas. Conservar recursos fuente/visuales, lockfile y migraciones; excluir entorno privado, dependencias, generados de compilación, datos PostgreSQL, capturas y aplicaciones temporales. Propuesta de etapa 4 solo en chat después del commit; implementación y dependencias todavía no autorizadas. No realizar otro cambio de archivos después del commit para mantener el estado limpio solicitado.

## 2026-11-04 — Etapa 4: confirmación atómica y compensación sencilla

Contexto: checkout académico aprobado en prompt 011, sin reserva de stock ni dinero real. Dos usuarios pueden pagar externamente por la última unidad antes de confirmar en PostgreSQL.

Decisión: servicio compartido de pedidos y sustitución exclusiva del proveedor. Simulador durable predeterminado; SDK oficial transbank-sdk 6.1.1 con constantes y host de integración. Idempotencia por usuario/solicitud, bloqueo breve del carrito al crear y stock condicional en orden estable al confirmar. Snapshots y reclamaciones persistidas; llamadas externas fuera de transacciones. Solo se vacía el carrito no modificado.

Consecuencias: puede requerirse reversa si falta stock. Se intenta compensación oficial y se registra el resultado permitido; si es incierto queda en revisión, sin colas ni reintentos ciegos. Tras reinicio se consulta estado. Create sin token no tiene recuperación automática. Token cifrado con secreto separado estable; logs por lista permitida y Referrer-Policy no-referrer. Prueba manual con proveedor oficial pendiente. Prioriza trazabilidad y sencillez sobre disponibilidad comercial continua.

## 2026-11-05 — Cierre versionado de etapa 4 y límite de etapa 5

Prompt 012 autoriza commit después de auditoría y verificación. Se conserva expresamente la prueba manual pendiente contra sandbox oficial de Transbank. Etapa 5 se propone en chat después del commit para mantener limpio el repositorio; no se crean módulos, migraciones ni configuración activa de analítica hasta nueva aprobación.

## 2026-11-05 — Etapa 5: analítica opt-in y métricas locales

Contexto: evaluar desempeño académico sin servicios de pago ni rediseño. Decisión: gtag.js directo y Next Web Vitals, sin dependencias nuevas; datos comerciales desde servidor, rutas/títulos normalizados, consentimiento básico, propiedad separada para sintéticos. Una columna nullable permite reclamación purchase atómica. Representa como máximo un intento de envío, no un acuse; pérdida posterior puede subregistrar y PostgreSQL prevalece. Web Vitals propios consolidados por ID/secuencia, recursos opcionales y logs/exportación fuera de la base medida. Sin colas, dashboards externos ni escenarios k6. Reportar por separado CPU Node/Docker y errores comerciales/técnicos; no presentar pruebas funcionales como benchmark. Configuración/DebugView y accesos reales permanecen manuales y pendientes.

## 2026-11-05 — Preparación serverless sin publicación ni escrituras cloud

Prompt 015: conservar Node/PrismaPg y la aplicación modular; pool Vercel por defecto 2, reutilización por instancia, runtime Node y TLS verificable. Vercel bloquea monitor periódico y todo Webpay. CLI cloud exige archivo exclusivo, endpoint/base confirmados y --execute, con simulación sin red por defecto; solo migrate deploy. Bootstrap solo inserta y no repone stock, a diferencia del seed general. Las regresiones usan seis bases nuevas _test y huella de lectura de la tienda habitual. Sin servicios nuevos, migraciones remotas, commits ni despliegue. Snapshot previo de etapa 5 permite dos commits separados tras aprobación.


## Carrito invitado y comprobantes de fusión — 2026-11-05

Contexto: se requiere carrito sin cuenta y fusión sin duplicación ante recargas o respuestas perdidas. Decisión: localStorage conserva solo IDs/cantidades; PostgreSQL cotiza y valida. La fusión autenticada crea CartMergeReceipt y suma cantidades en la misma transacción, con clave única y bloqueo de la fila del carrito mediante upsert. Un conflicto de stock revierte todo y conserva la copia anónima. Web Locks serializa cambios entre pestañas. Consecuencias: una migración aditiva autorizada exclusivamente en bases locales _test; deberá aprobarse aparte su aplicación en Neon antes de publicar. No hay reserva de stock ni doble evento add_to_cart. Ver [contratos, pruebas y límites](../guest-cart.md).
