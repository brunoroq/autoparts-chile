# Arquitectura propuesta y aprobada

## Criterio principal

Un monolito modular con una base PostgreSQL. Su propósito es permitir mediciones e identificar cuellos de botella. Separar responsabilidades sin añadir frameworks, servicios o capas innecesarias. Las carpetas siguientes son una previsión; solo se crearán cuando haya código que las necesite.

```text
Navegador -> Next.js App Router -> servicios de aplicación -> Prisma -> PostgreSQL
                    |                       |
                 GA4/Web Vitals         proveedor de pago
                                       |              |
                                   simulador    Webpay integración

k6 HTTP -> API REST de la misma aplicación
Navegadores de evaluación -> interfaz durante carga
Logs y métricas -> evidencia por ejecución
```

Server Components por defecto; componentes de cliente cuando la interacción lo requiera. Las páginas de servidor y Route Handlers reutilizan servicios sin HTTP interno. Runtime Node.js para persistencia y pagos. No usar datos estáticos como sustituto de consultas en recorridos medidos.

## Módulos y datos

- Catálogo: categorías, productos, búsqueda, filtros y paginación con límites.
- Usuarios: registro, autenticación Auth.js y autorización del lado servidor.
- Carrito: persistencia y operaciones sobre cantidades; resolver el comportamiento anónimo antes de implementarlo.
- Pedidos: checkout, historial privado y detalle; conservar nombre y precio comprado.
- Pagos: interfaz pequeña con adaptadores de simulación y Webpay de integración.

Entidades previstas: `User`, `Category`, `Product`, `Cart`, `CartItem`, `Order`, `OrderItem`, `PaymentAttempt` y las entidades que requiera Auth.js. Montos CLP enteros. El servidor valida cantidades, stock y precios. Usar transacciones, control de concurrencia e idempotencia en checkout. Definir estados de pedido y pago, y comportamiento de cancelación, antes de codificar ese flujo.

La llamada externa de Webpay no debe mantener una transacción de base de datos abierta. La coordinación y recuperación de estados se diseñarán en la etapa de pagos, con pruebas de duplicados y retornos fallidos.

## API prevista

| Recurso | Operaciones principales |
| --- | --- |
| `/api/v1/products` | GET con búsqueda, filtros y paginación |
| `/api/v1/products/[id]` | GET de detalle |
| `/api/v1/categories` | GET de categorías |
| `/api/v1/users` | POST de registro |
| `/api/auth/[...nextauth]` | Autenticación administrada por Auth.js |
| `/api/v1/cart` y `/api/v1/cart/items` | Lectura y modificación del carrito |
| `/api/v1/checkout` | Creación idempotente de compra de prueba |
| `/api/v1/orders` y `/api/v1/orders/[id]` | Historial y detalle autorizado |

Los contratos finales, métodos por elemento y rutas de retorno del pago se definirán antes de su implementación. k6 utilizará la API real, con usuarios y datos de prueba; no se crearán endpoints que omitan autorización para facilitar carga.

## Estructura prevista

```text
prisma/                  esquema, migraciones y semillas
src/app/(store)/         inicio, catálogo, detalle, carrito y checkout
src/app/(auth)/          registro y acceso
src/app/account/orders/  historial
src/app/api/             Auth.js y API v1
src/components/ui/       componentes compartidos necesarios
src/modules/             catalog, users, cart, orders, payments
src/lib/                 db, auth, config, observability, analytics
tests/                   unit, integration, e2e
load-tests/              scenarios, journeys, data
scripts/                 utilidades reproducibles
infra/                   configuración de infraestructura necesaria
docs/                    arquitectura, decisiones y evidencias
```

## Infraestructura y observabilidad

Docker Compose está configurado para PostgreSQL local con volumen persistente y healthcheck. La aplicación corre en el host; se evaluará contenerizarla solo si simplifica la reproducción. La etapa 1 incorpora exclusivamente base técnica, página provisional y esquema inicial.

Etapa 2: inicio, `/catalogo` y `/productos/[slug]` dinámicos con consultas directas a servicios Prisma compartidos con tres endpoints GET v1. Los módulos concretos son `service.ts`, `queries.ts` y `validation.ts`; los tipos públicos se derivan de los servicios en lugar de mantener un archivo duplicado. Listado/conteo usan snapshot RepeatableRead y orden con ID de desempate. Instrumentación en stdout y Server-Timing, sin colector adicional. [Contratos y límites](api/catalog.md).

El seed mantiene datos locales de demostración y una base `_test` separada para integración. Imágenes locales con Next Image y caché de imagen separada de los datos de catálogo. Única dependencia nueva: Playwright en desarrollo para las verificaciones; sin nuevas dependencias de producción. Fotografías autorizadas e ilustraciones propias documentadas en [recursos visuales](images.md).

Etapa 3: NextAuth 4.24.15 Credentials/JWT, persistencia propia de User/Cart sin adaptador Auth.js; scrypt asíncrono nativo. Sesión de servidor y autorización por propietario en todos los endpoints privados. Nueva columna passwordHash y Cart.version; mutaciones con CAS transaccional e If-Match. Sin reserva de stock ni checkout. El helper compartido usa AsyncLocalStorage para db/auth/hash y conserva respuestas/cookies de NextAuth. [Contratos](api/auth-cart.md).

Autenticación se verifica en otra base, `autoparts_auth_test`; las cuentas ficticias no se crean en la base habitual. Diseño conservado, con nuevas pantallas/acciones de cuenta y carrito. Sin servicios externos, tablas de sesiones ni dependencias de hashing.

El cloud gratuito se seleccionará según cuotas, posibilidad de observar recursos y condiciones de carga. Si no expone CPU, memoria o I/O, declarar la limitación y obtener esas métricas localmente; consultar con el docente si esa evidencia no satisface la evaluación. No inventar métricas de infraestructura.

Logs estructurados con solicitud, ejecución, ruta normalizada, método, estado y duración. No almacenar logs de cada petición en PostgreSQL medido por defecto: la instrumentación podría alterar el experimento. Elegir un destino sencillo y documentar su costo.

La línea base no usará caché de datos para evitar consultas en rutas evaluadas. Documentar también caché del navegador/CDN, calentamiento y reutilización de conexiones. Cada optimización se compara contra la misma carga y conjunto de datos.

GA4 medirá embudo y engagement; Web Vitals medirá experiencia de navegador. k6 HTTP medirá API y carga. Mantener una propiedad GA4 de evaluación e identificar tráfico sintético; confirmar compras solo tras persistir su resultado y evitar eventos duplicados.

Etapa 4 vigente: `/checkout`, `/pedidos`, `/pedidos/[id]` y página privada de redirección a Webpay. `modules/orders` comparte reglas entre UI y API; `modules/payments` implementa proveedores y protección de tokens. Migración aditiva, idempotencia por usuario, snapshots y confirmación atómica de stock. Se añade providerMs a la instrumentación existente. No se implementan carpetas hipotéticas de etapas futuras. Consultar [flujo y recuperación](stage-4.md), [API](api/checkout-orders.md) y [evidencias](verification-stage-4.md).

Etapa 5: AnalyticsProvider cliente rodea contenido de servidor sin trasladar consultas al navegador. gtag.js por next/script solo con configuración y consentimiento; contratos por lista permitida, marcas locales y reclamación purchase en PostgreSQL. Web Vitals a receptor propio acotado; Node/PostgreSQL por instrumentation y Docker con CLI externo. Exportaciones locales sin servicios nuevos. Consultar [configuración, fuentes y límites](stage-5.md).

Preparación cloud aprobada por prompt 015: mismo monolito en Node24, PrismaPg/TCP con Neon pooled y pool por instancia acotado. CLI administrativa separada y validada; scripts de simulación por defecto. Vercel sin monitor periódico, sin filesystem persistente de métricas y con simulador exclusivo. Sin nuevas dependencias ni publicación realizada. Ver deployment-vercel-neon.md.
