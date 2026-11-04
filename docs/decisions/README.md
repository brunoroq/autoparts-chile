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
