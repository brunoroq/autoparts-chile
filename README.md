# AutoParts Chile

Proyecto universitario de **INFB8091 - Desempeño de Sistemas**: tienda de accesorios automotrices para estudiar el rendimiento de una aplicación con datos reales y tráfico sintético.

## Estado

Etapas 0 a 5 versionadas; cierre de etapa 5: 69fe039280522b79f0b147432cee0afc2778ee6a. Preparación Vercel/Neon incluida en un segundo commit local separado autorizado por prompt 016 (consultar Git). Analytics y métricas opcionales desactivados por defecto. Sin propiedad GA4 real, acceso externo, despliegue, k6 ni etapa 6. Webpay oficial sigue pendiente de compra manual.

La preparación Vercel/Neon está implementada, verificada localmente y versionada por separado de etapa 5, sin push ni publicación. La base Docker habitual se conserva íntegra; continuar con configuración manual de Neon.

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
- [Propuesta de etapa 2](docs/stage-2-proposal.md): alcance aprobado.
- [API de catálogo](docs/api/catalog.md): contratos, errores e instrumentación.
- [Imágenes](docs/images.md): procedencia, licencia y optimización.
- [Verificación de etapa 2](docs/verification-stage-2.md): pruebas, resultados e inventario de cambios.
- [Propuesta de etapa 3](docs/stage-3-proposal.md): alcance aprobado y diseño conservado.
- [API de usuarios y carrito](docs/api/auth-cart.md): autenticación, seguridad, concurrencia y contratos.
- [Verificación de etapa 3](docs/verification-stage-3.md): pruebas, límites e inventario.
- [Etapa 4 y revisión manual](docs/stage-4.md): flujo, estados, reversas, configuración y limitaciones.
- [API de checkout y pedidos](docs/api/checkout-orders.md): contratos para evaluación posterior.
- [Verificación de etapa 4](docs/verification-stage-4.md): evidencia y archivos afectados.

- [Etapa 5 y configuración GA4/DebugView](docs/stage-5.md): eventos, consentimiento, métricas y exportaciones.
- [Verificación de etapa 5](docs/verification-stage-5.md): resultados, errores y limitaciones.

- [Preparación Vercel/Neon](docs/deployment-vercel-neon.md): variables, scripts cloud protegidos y pasos manuales pendientes.
- [Verificación de preparación](docs/verification-deployment-preparation.md): pruebas aisladas y conservación local.
- [Plan de dos commits](docs/commit-plan-stage5-deployment.md): separación de etapa 5 y despliegue, sin commits realizados.

- [Carrito de invitados y fusión segura](docs/guest-cart.md): implementación local, migración autorizada solo en bases _test, pruebas y revisión manual. Neon no fue modificado.

## Inicio de una sesión

Leer `AGENTS.md` y `LogFile.txt`, revisar el estado de Git y confirmar el alcance autorizado antes de modificar archivos.

## Stack previsto

Node.js 24.21.0, npm 11.19.0, Next.js 16.4.5, React 19.3.1, TypeScript 5.9.3 estricto, Tailwind CSS 4.3.4, Prisma 7.10.1, PostgreSQL 17.11 y NextAuth 4.24.15 estable. Versiones directas fijadas y lockfile versionado. Scrypt nativo de Node, sin dependencia de hash adicional. Transbank, GA4 y k6 no están instalados.

## Puesta en marcha local (PowerShell)

Requisitos: Node/npm indicados y Docker Desktop activo con Compose y contenedores Linux. Si Docker se instaló recientemente, abrir una terminal nueva para actualizar PATH.

```powershell
Copy-Item .env.example .env
# Editar .env: reemplazar la contraseña de ejemplo y sincronizar DATABASE_URL.
# Configurar NEXTAUTH_URL=http://localhost:3000 y NEXTAUTH_SECRET aleatorio (48 bytes).
npm ci
npm run db:up
npm run db:generate
npm run db:deploy
npm run db:seed -- --size 30
npm run db:check
npm run dev
```

No sobrescribir un `.env` existente. Se creó uno local con contraseña aleatoria; no está versionado. El seed carga seis categorías y 30 productos ficticios. Inicio, catálogo, detalle y API consultan PostgreSQL realmente; el servidor debe tener acceso a la base. No se expone un endpoint público de diagnóstico.

Abrir http://localhost:3000. La app se enlaza a loopback, no a toda la red. PostgreSQL también está limitado a localhost.

## Validación y ejecución de producción local

```powershell
npm run validate
npm run build
npm start
# En otra terminal, con npm start activo:
npm run check:http
```

`validate` ejecuta lint, tipos y validación de Prisma. Next.js genera el cliente Prisma durante build y typecheck; `.env` debe existir también para estos comandos. Las páginas de catálogo son dinámicas y no consultan la base durante la compilación. Detener el servidor antes de reconstruir y volver a iniciarlo después para no mezclar archivos de builds diferentes. `check:http` verifica inicio, catálogo, detalle, API y optimización de imágenes. `db:check` consulta las ocho tablas reales.

## Revisar la tienda

- Inicio: http://localhost:3000
- Catálogo: http://localhost:3000/catalogo
- Ejemplo de búsqueda: http://localhost:3000/catalogo?q=LED&category=iluminacion&sort=price_asc
- API: http://localhost:3000/api/v1/products y http://localhost:3000/api/v1/categories
- Crear cuenta: http://localhost:3000/registro
- Iniciar sesión: http://localhost:3000/iniciar-sesion
- Carrito privado: http://localhost:3000/carrito

Los filtros se conservan en la URL, el formulario reinicia a página 1 y la paginación conserva criterios. En móvil los filtros comienzan plegados; se abren por clic o teclado. Los precios son CLP enteros, las imágenes de producto son ilustraciones referenciales y todas las existencias son de prueba.

Para revisar el flujo: crear tu propia cuenta (sin credenciales predeterminadas), iniciar sesión, abrir un detalle, indicar cantidad y agregar al carrito. Allí puedes cambiar cantidades y eliminar líneas. Salir y volver a iniciar conserva el carrito en PostgreSQL. Continuar al checkout, crear un pedido y simular su pago; revisar historial en `/pedidos`. El stock se descuenta solo al confirmar. Usar el origen exacto configurado en NEXTAUTH_URL para evitar rechazo de Origin.

## Pruebas

```powershell
npm test
npm run test:prepare
npm run test:integration
npm run test:auth:prepare
npm run test:auth:integration
# Requieren el servidor de producción activo en localhost:3000:
npm run test:http
# En otra terminal, servidor exclusivo de pruebas en localhost:3002:
npm run test:auth:server
# Después, en otra terminal:
npm run test:auth:http
npm run test:browser
npm run test:auth:restart
# Checkout: preparar otra base aislada y ejecutar sus pruebas:
npm run test:checkout:prepare
npm run test:checkout:integration
npm run test:checkout:restart
# En otra terminal, dejar activo localhost:3004 junto a 3000 y 3002:
npm run test:checkout:server
# En la terminal de pruebas:
npm run test:checkout:http
npm run test:browser
```

Playwright 1.64.1 es una dependencia exclusiva de desarrollo y usa Chrome instalado (channel chrome). Las pruebas cubren 1440x1000 y 390x844, catálogo, cuenta, carrito, conflictos, teclado y foco; capturas e informes quedan en `test-results/` ignorado por Git. Para otro equipo, instalar Chrome desde su proveedor o adaptar channel de forma explícita; no se descargó otro navegador aquí. La única dependencia nueva de producción de etapa 3 es next-auth.

La integración escribe solo en una base local terminada en `_test`, por defecto `autoparts_catalog_test`, y la deja en 10.000 productos. No borra datos ni cambia el catálogo habitual de 30. [Preparación y seeds aislados](docs/database.md).

Las pruebas de cuenta usan `autoparts_auth_test`, con 30 productos y usuarios ficticios únicos generados en ejecución. `test:auth:server` deriva un secreto distinto y configura NEXTAUTH_URL para localhost:3002; no crea cuentas en `autoparts`. `test:auth:restart` administra un servidor efímero en 3104 y `test:auth:compat` una app temporal en 3103. Son verificaciones funcionales acotadas, no generadores de carga. Detener los servidores propios antes de recompilar.

El caso de error HTTP requiere un servidor separado en puerto 3001 con DATABASE_URL apuntando a un puerto local sin PostgreSQL; ejecutar `npm run test:http:error` contra ese servidor. El procedimiento exacto está en [verificación de etapa 2](docs/verification-stage-2.md). No detener PostgreSQL de la tienda para provocar un fallo.

Para detener PostgreSQL conservando datos: `npm run db:down`. Para consultar salud: `npm run db:status`. Las mediciones de carga futuras utilizarán build de producción, nunca `npm run dev`.

## Analítica y métricas opcionales

Todo permanece desactivado por defecto. Seguir [etapa 5](docs/stage-5.md) para configurar GA4, consentimiento y DebugView antes de habilitarlo. PostgreSQL conserva la verdad de las compras; purchase reclamado no acredita recepción de Google. Para verificar sin servicios externos: npm run test:analytics:prepare, npm run test:analytics:integration y npm run test:observability. Las exportaciones se generan con npm run metrics:export; el manifiesto y Docker con metrics:manifest y metrics:docker. Consultar el documento para captura UTF-8, duración medida y separación de tráfico. No se configura acceso del profesor ni despliegue.
