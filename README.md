# AutoParts Chile

Proyecto universitario de **INFB8091 - Desempeño de Sistemas**: tienda de accesorios automotrices para estudiar el rendimiento de una aplicación con datos reales y tráfico sintético.

## Estado

Etapa 0 completada y registrada en el commit `adbfa0e`. Etapa 1 implementada: Next.js, página provisional, PostgreSQL con Compose y esquema Prisma inicial. Sin funcionalidades de tienda ni despliegue. La etapa 2 requiere aprobación del usuario.

## Documentación

- [Instrucciones permanentes](AGENTS.md): protocolo de sesiones, aprobaciones, código y validación.
- [Registro de prompts](LogFile.txt): solicitudes completas, autorizaciones y cambios.
- [Requisitos y entregables](docs/requirements.md): análisis del enunciado y requisitos adicionales del usuario.
- [Arquitectura](docs/architecture.md): componentes, datos, API y estructura prevista.
- [Plan de implementación](docs/implementation-plan.md): etapas y criterios de aceptación.
- [Decisiones técnicas](docs/decisions/README.md): contexto y consecuencias de las decisiones importantes.
- [Metodología de evaluación](docs/performance/methodology.md): escenarios, catálogos, métricas y comparación local/cloud.
- [Base de datos](docs/database.md): esquema, conexión y migraciones.
- [Verificación de etapa 1](docs/verification-stage-1.md): resultados y errores encontrados.

## Inicio de una sesión

Leer `AGENTS.md` y `LogFile.txt`, revisar el estado de Git y confirmar el alcance autorizado antes de modificar archivos.

## Stack previsto

Node.js 24.21.0, npm 11.19.0, Next.js 16.4.5, React 19.3.1, TypeScript 5.9.3 estricto, Tailwind CSS 4.3.4, Prisma 7.10.1 y PostgreSQL 17.11. Versiones directas fijadas y lockfile versionado. Auth.js, pagos, GA4 y k6 no están instalados; corresponden a etapas posteriores.

## Puesta en marcha local (PowerShell)

Requisitos: Node/npm indicados y Docker Desktop activo con Compose y contenedores Linux. Si Docker se instaló recientemente, abrir una terminal nueva para actualizar PATH.

```powershell
Copy-Item .env.example .env
# Editar .env: reemplazar la contraseña de ejemplo y sincronizar DATABASE_URL.
npm ci
npm run db:up
npm run db:generate
npm run db:deploy
npm run db:check
npm run dev
```

No sobrescribir un `.env` existente. En la implementación inicial se creó uno local con contraseña aleatoria; no está versionado. La base inicial queda vacía y la página no depende de consultas a PostgreSQL todavía. La conexión se verifica por separado, sin exponer un endpoint público de diagnóstico.

Abrir http://localhost:3000. La app se enlaza a loopback, no a toda la red. PostgreSQL también está limitado a localhost.

## Validación y ejecución de producción local

```powershell
npm run validate
npm run build
npm start
# En otra terminal, con npm start activo:
npm run check:http
```

`validate` ejecuta lint, tipos y validación de Prisma. Next.js genera el cliente Prisma durante build y typecheck; `.env` debe existir también para estos comandos, aunque la página provisional no consulta la base durante la compilación. `check:http` verifica HTTP 200, título, idioma, contenido y CSS en localhost:3000. `db:check` es una comprobación de integración real. No hay pruebas de negocio porque aún no hay reglas implementadas.

Para detener PostgreSQL conservando datos: `npm run db:down`. Para consultar salud: `npm run db:status`. Las mediciones de carga futuras utilizarán build de producción, nunca `npm run dev`.
