# AutoParts Chile

**Kernel en Crisis** · **Universidad Tecnológica Metropolitana (UTEM)**  
**INFB8091 — Desempeño de Sistemas** · Segundo semestre de 2026

AutoParts Chile es una plataforma web de comercio electrónico de accesorios automotrices, desarrollada como proyecto académico para estudiar el comportamiento de una aplicación ante diferentes condiciones de carga.

El trabajo combina la implementación de una tienda funcional con pruebas de rendimiento, monitoreo de recursos, analítica web y evaluación de la experiencia de navegación.

## Funcionalidades

- Catálogo de productos con búsqueda, filtros, ordenamiento y paginación.
- Páginas de detalle con precios en pesos chilenos (CLP).
- Registro, autenticación y gestión de sesiones.
- Carrito de compras para visitantes y usuarios autenticados.
- Checkout, registro de pedidos y actualización de inventario.
- Pagos de prueba mediante un proveedor simulado e integración con Webpay Plus en ambiente de integración.
- Instrumentación con Google Analytics 4 y métricas de rendimiento.

## Tecnologías

| Tecnología | Uso en el proyecto |
| --- | --- |
| Next.js y React | Aplicación web e interfaz de usuario |
| TypeScript | Desarrollo con tipado estático |
| PostgreSQL y Prisma | Persistencia y acceso a datos |
| NextAuth | Autenticación y sesiones |
| Tailwind CSS | Diseño de la interfaz |
| Transbank SDK | Integración de Webpay Plus |
| k6 | Pruebas de carga y rendimiento |
| Docker | Laboratorios locales de evaluación |
| Google Analytics 4 | Registro de eventos de navegación y comercio electrónico |
| Chrome DevTools | Mediciones de Core Web Vitals |
| Vercel y Neon | Despliegue público y base de datos |

## Evaluación de desempeño

Se realizaron pruebas con **k6** para medir latencia, throughput y errores HTTP en diferentes escenarios de navegación. También se evaluó el consumo de recursos de la aplicación y de PostgreSQL.

| Escenario | Usuarios virtuales (VUs) | Propósito |
| --- | ---: | --- |
| Navegación — carga baja | 3 | Caracterizar el rendimiento inicial |
| Navegación — carga normal | 10 | Medir tiempos de respuesta y throughput |
| Navegación — carga alta | 30 | Evaluar el comportamiento con mayor concurrencia |
| Prueba de estrés | 500 | Observar la degradación bajo una carga exigente |
| Compras concurrentes | 10 | Verificar pedidos, pagos simulados e inventario |

### Resultados destacados

- **Navegación con 3, 10 y 30 VUs:** las solicitudes de la serie histórica finalizaron sin errores HTTP. En ventanas comparables de 59 segundos, el throughput aumentó de **2,814 a 27,339 solicitudes/s**.
- **Estrés con 500 VUs:** el p95 de la aplicación alcanzó **2.673,844 ms** y se registraron **47 respuestas HTTP 500** en consultas al catálogo. Esto permitió identificar oportunidades de optimización bajo alta carga.
- **Compras concurrentes:** se completaron **10 compras de prueba**, con 10 pedidos en estado `PAID`, pagos simulados aprobados y una reducción correcta de 10 unidades de inventario.
- **Webpay Plus:** se comprobó una transacción manual en el ambiente de integración, con registro del pago y actualización del inventario.

Los resultados detallados, gráficos y condiciones de cada experimento se presentan en el informe académico y en la documentación de rendimiento.

## Analítica y experiencia de usuario

La plataforma incorpora **Google Analytics 4 (GA4)** para registrar eventos de navegación y comercio electrónico, incluidos `view_item`, `add_to_cart`, `begin_checkout` y `purchase`.

También se realizaron mediciones de **Core Web Vitals** —LCP, INP y CLS— en páginas representativas de la tienda, como complemento a las pruebas de carga del servidor.

## Ejecución local

### Requisitos

- Node.js y npm compatibles con las versiones del proyecto.
- Docker Desktop con soporte para contenedores Linux.
- PostgreSQL configurado mediante los archivos del proyecto.

### Instalación

En PowerShell, desde la raíz del repositorio:

```powershell
Copy-Item .env.example .env
# Configurar DATABASE_URL, NEXTAUTH_URL y NEXTAUTH_SECRET en .env
npm ci
npm run db:up
npm run db:generate
npm run db:deploy
npm run db:seed -- --size 30
npm run db:check
npm run dev
```

La aplicación estará disponible en **http://localhost:3000**.

> Si ya existe un archivo `.env`, conserva su configuración y no lo sobrescribas. Las credenciales y secretos deben permanecer fuera del control de versiones.

### Validaciones básicas

```powershell
npm run validate
npm run build
npm test
```

Los procedimientos de pruebas de integración, ejecución de servidores aislados y preparación de bases de datos se describen en la documentación técnica del repositorio.

## Documentación

| Documento | Contenido |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Instrucciones de trabajo y desarrollo |
| [LogFile.txt](LogFile.txt) | Registro de interacciones y prompts |
| [Requisitos del proyecto](docs/requirements.md) | Alcance y entregables académicos |
| [Arquitectura](docs/architecture.md) | Componentes y organización de la aplicación |
| [Base de datos](docs/database.md) | Esquema, conexión y migraciones |
| [Metodología de evaluación](docs/performance/methodology.md) | Escenarios y métricas de rendimiento |
| [Checkout y pedidos](docs/api/checkout-orders.md) | Contratos de la API de compras |
| [Integración GA4](docs/stage-5.md) | Eventos, consentimiento y analítica |
| [Despliegue Vercel/Neon](docs/deployment-vercel-neon.md) | Configuración del despliegue |
| [Decisiones técnicas](docs/decisions/README.md) | Principales decisiones de implementación |

La documentación de cada etapa, las verificaciones y los registros experimentales complementan el informe final del proyecto.

## Equipo

**Kernel en Crisis**  
Universidad Tecnológica Metropolitana (UTEM)  
Asignatura: **INFB8091 — Desempeño de Sistemas**  
Período: **Segundo semestre de 2026**

**Integrantes:** _[Completar con los cuatro integrantes]_  
**Docente:** Javier Etienne Aranda Bellenger

---

*Proyecto desarrollado con fines académicos. Las compras y los pagos descritos corresponden a entornos de prueba.*
