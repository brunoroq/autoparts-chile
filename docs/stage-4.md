# Etapa 4: checkout y pagos académicos

## Alcance y arquitectura

Implementación autorizada por prompt 011. Conserva el monolito modular, identidad visual y PostgreSQL real. No incluye despacho, direcciones, facturas, GA4, k6 ni despliegues. `transbank-sdk@6.1.1` es la única dependencia directa nueva de producción; requiere Node >=18 y es compatible con Node 24 del proyecto. ESLint permanece en 9.

`src/modules/orders/service.ts` contiene creación, snapshots, historial, autorización y confirmación. `src/modules/payments/providers.ts` sustituye únicamente las llamadas al proveedor. Ambos proveedores comparten las mismas reglas de pedidos, stock e idempotencia. No existe una opción pública para seleccionar Webpay o cambiar su ambiente.

1. Checkout autenticado recibe versión del carrito e Idempotency-Key. Bloquea brevemente la fila del carrito, busca primero el pedido idempotente y después valida carrito, productos activos, cantidades y stock. Calcula el total CLP y persiste copias del nombre, precio y cantidad. No reserva ni descuenta stock.
2. Una clave pertenece a un usuario y al hash de la solicitud normalizada. Repetir la misma solicitud devuelve el mismo pedido aunque el carrito haya cambiado o se haya vaciado. Otra versión con la misma clave devuelve 409. Un pedido pendiente o en revisión impide crear otro desde ese carrito.
3. Webpay crea la transacción fuera de PostgreSQL. Una reclamación condicional persistente impide dos llamadas simultáneas. Se guarda referencia comercial aleatoria, sesión de pago independiente de la sesión de autenticación, hash del token para búsqueda y token cifrado con AES-256-GCM. No se guardan respuestas completas ni datos de tarjetas, incluyendo sus últimos dígitos.
4. El retorno usa token o el par referencia/sesión; la aplicación consulta o confirma desde servidor. La identidad externa, monto, estado AUTHORIZED y response_code 0 deben coincidir. Los retornos no dependen de cookies de usuario: la consulta privada posterior sí exige sesión y propiedad del pedido. POST de retorno es la excepción intencional a Origin/CSRF; los endpoints propios de mutación mantienen Origin y cookies SameSite.
5. La confirmación toma bloqueo del pedido, verifica la reclamación vigente y actualiza productos por ID en orden estable, con condición `stock >= cantidad`. Todo ocurre en una transacción: si un producto falla, se revierten todos los descuentos. Pedido PAID y pago APPROVED se guardan junto con el stock. Retornos duplicados no descuentan otra vez.
6. El carrito se vacía solo si su versión todavía coincide con el snapshot comprado. Cambios posteriores se conservan. Sus productos no reservan stock.
7. Si el proveedor aprobó pero no se puede confirmar localmente, se persiste REVERSAL_PENDING y se solicita `refund(token, total)` fuera de la transacción. REVERSED confirma reversa; NULLIFIED exige código 0, monto anulado exacto y saldo 0. Se registra solo el resultado permitido. Un error o resultado no verificable deja REVIEW / REVERSAL_PENDING, sin reintentos automáticos.

## Estados, timeouts y recuperación

| Situación | Pedido | Pago |
| --- | --- | --- |
| Creado | PENDING | PENDING |
| Operación en curso | PENDING o REVIEW | PROCESSING |
| Compra confirmada | PAID | APPROVED |
| Rechazo | FAILED | REJECTED |
| Cancelación verificada | CANCELLED | CANCELLED |
| Timeout / evidencia incompatible | REVIEW | UNKNOWN |
| Estado externo todavía INITIALIZED al consultar | PENDING | UNKNOWN |
| Compensación verificada | CANCELLED | REVERSED |
| Reversa incierta | REVIEW | REVERSAL_PENDING |

Una reclamación en curso devuelve 409 a solicitudes simultáneas. Después de 30 segundos puede sustituirse para **consultar estado**, nunca para repetir commit o refund. El identificador de reclamación actúa como cerrojo de finalización: una respuesta tardía no puede sobrescribir una verificación posterior. No existe cola, cron ni sistema distribuido de reintentos. Si el proceso cae entre registrar una reversa y enviarla, se requiere revisión manual; se prioriza evitar una segunda reversa ciega.

Un create indeterminado sin token no puede reconciliarse automáticamente y queda en revisión. No se vuelve a crear el cargo. Un token con secreto perdido o cambiado tampoco se puede recuperar automáticamente. Mantener `PAYMENT_TOKEN_SECRET` estable y fuera de Git. Un retorno sin token usa exclusivamente referencia y sesión persistidas para consultar; nunca interpreta esos parámetros como aprobación.

El simulador persiste su escenario antes de operar. `approved`, `rejected` y `cancelled` son definitivos; `timeout` permanece INITIALIZED, sin autorización; `timeout-approved` se resuelve al consultar. `reversal-failed` y `reversal-timeout` aprueban y permiten reproducir la compensación incierta si el stock desaparece antes de confirmar. Consultar un pago simulado aún sin escenario no lo aprueba.

## Configuración y revisión manual

Aplicar migraciones con `npm run db:deploy` (solo base local; no despliega la aplicación). Iniciar Docker con `npm run db:up`. Usar el origen exacto de NEXTAUTH_URL, por defecto http://localhost:3000.

### Compra simulada

1. Mantener `PAYMENT_PROVIDER=simulated` o dejarlo sin definir. Iniciar con `npm run dev`, o detener el servidor, ejecutar `npm run build` y luego `npm start`.
2. Registrarse e iniciar sesión con una cuenta propia. Agregar un producto disponible al carrito.
3. Abrir `/carrito`, continuar a `/checkout` y crear el pedido de prueba.
4. En su detalle seleccionar Aprobado y pulsar Simular pago. Debe aparecer Compra confirmada; el stock se descuenta una vez y el carrito se vacía si no fue modificado.
5. Revisar `/pedidos`. Para rechazo o cancelación, usar un pedido nuevo. Para recuperación seleccionar Timeout con autorización recuperable, recargar y pulsar Verificar estado del pago.

### Webpay Plus de integración

1. Generar localmente un secreto: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Guardarlo solo en `.env` como PAYMENT_TOKEN_SECRET, sin compartirlo ni adjuntarlo a capturas.
2. Configurar `PAYMENT_PROVIDER=webpay_integration`, `WEBPAY_ENVIRONMENT=integration` y NEXTAUTH_URL. Reiniciar Next.js; la aplicación utiliza exclusivamente las constantes públicas de integración del SDK y el host oficial de integración. No acepta credenciales/ambiente de producción.
3. Crear un pedido nuevo. Pulsar Continuar a Webpay de integración y luego Ir al pago de prueba. El formulario envía el token por POST al dominio permitido, sin incluirlo en logs de la aplicación.
4. Usar únicamente los datos de prueba publicados en [Ambientes de Transbank](https://transbankdevelopers.com/documentacion/como_empezar). Completar el flujo en Webpay y volver. La tarjeta se ingresa únicamente en Transbank.
5. Revisar el detalle: solo la verificación del servidor confirma la compra. Ante timeout usar Verificar estado del pago; ante revisión no repetir la compra. Para cancelación usar la opción del formulario externo y revisar el resultado consultado.
6. Si el navegador no puede volver a NEXTAUTH_URL, corregir la URL local accesible desde ese navegador y consultar el pedido existente. No se configuraron túneles ni despliegues. No se verificó una transacción real de integración en esta sesión.
7. Volver a `simulated` y reiniciar antes de pruebas automatizadas o de capacidad. Nunca apuntar una herramienta de carga a Webpay. Las pruebas entregadas fijan el simulador y usan bases aisladas.

Fuentes primarias consultadas: [flujo Webpay Plus](https://transbankdevelopers.com/documentacion/webpay-plus), [referencia de operaciones y reversas](https://github.com/TransbankDevelopers/transbank-developers-docs/blob/master/referencia/webpay/README.md), [SDK oficial](https://github.com/TransbankDevelopers/transbank-sdk-nodejs). La verificación automática del adaptador usa un transporte falso interno; ninguna ruta pública permite inyectarlo.

## Medición y limitaciones

Las rutas devuelven Cache-Control no-store, X-Request-Id y Server-Timing con app, db, auth, hash y provider. Los logs incluyen totalMs, dbMs y providerMs, por ruta normalizada. dbMs mide duración de operaciones/transacciones vistas por la aplicación, incluyendo espera de conexión y bloqueo; no es tiempo CPU puro de PostgreSQL. providerMs agrega las llamadas del proveedor, incluyendo latencia de red en Webpay. El simulador determinista no introduce una espera de red artificial. No son resultados de carga.

Las consultas externas tienen timeout de 10 segundos y un límite básico en memoria por proceso (60 operaciones/minuto globales, 6 por pago/minuto). Es una barrera local académica, no un control distribuido. Simulador sin estos límites de proveedor externo, para futura evaluación. Autenticación conserva sus límites existentes.

Escenarios futuros medibles: última unidad entre compradores, callbacks duplicados, varias líneas con rollback total, carrito editado después de checkout, respuesta tardía tras reinicio, autorización seguida de falta de stock, reversa verificada o incierta. No se implementó k6 ni se ejecutó carga. Bases de prueba mantienen fixtures acumulados y nunca se limpian automáticamente.
