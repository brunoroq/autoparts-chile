# AutoParts Chile

Proyecto universitario de **INFB8091 - Desempeño de Sistemas**: tienda de accesorios automotrices para estudiar el rendimiento de una aplicación con datos reales y tráfico sintético.

## Estado

Etapa 0: documentación inicial. La arquitectura y esta etapa fueron aprobadas el 4 de noviembre de 2026. No hay aplicación, dependencias, base de datos, pruebas ejecutables ni despliegue. La etapa 1 requiere aprobación del usuario.

## Documentación

- [Instrucciones permanentes](AGENTS.md): protocolo de sesiones, aprobaciones, código y validación.
- [Registro de prompts](LogFile.txt): solicitudes completas, autorizaciones y cambios.
- [Requisitos y entregables](docs/requirements.md): análisis del enunciado y requisitos adicionales del usuario.
- [Arquitectura](docs/architecture.md): componentes, datos, API y estructura prevista.
- [Plan de implementación](docs/implementation-plan.md): etapas y criterios de aceptación.
- [Decisiones técnicas](docs/decisions/README.md): contexto y consecuencias de las decisiones importantes.
- [Metodología de evaluación](docs/performance/methodology.md): escenarios, catálogos, métricas y comparación local/cloud.

## Inicio de una sesión

Leer `AGENTS.md` y `LogFile.txt`, revisar el estado de Git y confirmar el alcance autorizado antes de modificar archivos.

## Stack previsto

Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma, Auth.js, Webpay Plus de integración, simulador de pagos, GA4 y k6. Las versiones, el gestor de paquetes y el proveedor cloud se elegirán en etapas posteriores con compatibilidad verificada.

Se prevé Docker Compose para PostgreSQL local. Todavía no existen comandos de instalación, ejecución, pruebas o compilación: se documentarán cuando se apruebe e implemente la base técnica.
