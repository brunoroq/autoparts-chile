# Verificación de etapa 1

Fecha: 4 de noviembre de 2026, America/Santiago. Verificación funcional de base técnica, no prueba de desempeño.

## Resultados

| Comprobación | Resultado |
| --- | --- |
| Commit de etapa 0 | `adbfa0e`, autor brunoroq <broque@utem.cl>; sin push |
| Docker | Engine 29.9.2; Desktop 4.98.0; Compose 5.6.1; Linux/amd64 |
| Recursos de Docker | 12 CPU lógicas; 8.290.869.248 bytes de RAM (aproximadamente 7,72 GiB) |
| Compose | Configuración válida; `up -d --wait` exitoso |
| Contenedor | `autoparts-chile-postgres-1`, healthy; puerto 127.0.0.1:5432 |
| PostgreSQL | 17.11, Debian; pg_isready acepta conexiones |
| Prisma | Esquema formateado y validado; cliente 7.10.1 generado |
| Migraciones | `20261104234207_init` y `20261104234247_init` aplicadas; migrate status actualizado |
| Conexión real | SELECT 1 y consultas de conteo a las ocho tablas con Prisma; todos los conteos en cero |
| Lint | `npm run lint`, sin errores ni advertencias de lint |
| TypeScript | `npm run typecheck`, sin errores |
| Build | `npm run build`, compilación de producción exitosa |
| HTTP | `npm start` y `npm run check:http`: HTTP 200 en localhost:3000; título, idioma es-CL, contenido y CSS Tailwind verificados |
| Secretos | `.env` local ignorado; `.env.example` solo contiene valores de ejemplo |
| Auditoría | Producción: cero vulnerabilidades; auditoría completa: ocho avisos moderados de tooling de lint |

Digest de imagen observado: `postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5`. La etiqueta Compose fija parche y distribución; para un ensayo futuro registrar nuevamente el digest efectivo.

## Errores y acciones

1. Git carecía de identidad. Se configuró nombre/correo provistos por el usuario solo en el repositorio; commit documental completado.
2. El proceso del agente tenía PATH anterior a instalar Docker. Se localizó el ejecutable en `C:\Users\br1rk\AppData\Local\Programs\DockerDesktop\resources\bin` y se añadió al PATH únicamente de las invocaciones necesarias. No se cambió PATH global.
3. `tsx` falló dentro del sandbox con `uv_os_get_passwd returned ENOMEM`; la misma comprobación autorizada fuera del sandbox pasó. No fue un fallo de PostgreSQL ni se modificó el script para ocultarlo.
4. Se generó una segunda migración inicialmente vacía al repetir create-only; antes de aplicarla se incorporaron los CHECK de integridad en su SQL. La primera migración aplicada no fue reescrita. Las dos migraciones forman el historial inicial.
5. Una comprobación HTTP escrita en línea falló por comillas interpretadas por PowerShell. Se reemplazó por un script reproducible (`check-http.mjs`) y pasó.
6. npm informó ESLint 9 fuera de soporte y ocho avisos moderados derivados de minimatch en typescript-eslint. No se aplicó corrección forzada ni cambio de versión mayor no aprobado. `npm audit --omit=dev` reportó cero vulnerabilidades. Reevaluar tooling antes de etapas posteriores.
7. npm informó scripts de instalación sin registro allowScripts en tres paquetes; generación Prisma y ejecución de tsx/build se verificaron correctamente. No se habilitaron scripts globalmente.

## Alcance y límites

Sin catálogo, autenticación, carrito funcional, checkout, proveedor de pago, GA4 o k6. Sin datos semilla, pruebas de carga ni despliegue. No se incorporaron frameworks de tests adicionales. Las comprobaciones de conexión y HTTP son las pruebas de integración y smoke disponibles en esta etapa.

PostgreSQL y el servidor Next de producción se dejaron activos para revisión local. La página provisional no certifica conexión a la base: esa comprobación corresponde a `db:check`. La revisión HTTP y de CSS no sustituye una revisión visual en navegador, que no se realizó en esta etapa.
