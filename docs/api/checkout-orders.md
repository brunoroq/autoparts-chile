# API de checkout, pedidos y pagos

Todas las rutas usan sesión validada y autorización del servidor, salvo el retorno externo estrecho de Webpay. Las mutaciones propias exigen Origin igual a NEXTAUTH_URL. JSON acotado a 8 KiB, campos desconocidos rechazados. No enviar userId, precios, totales ni proveedor desde el cliente. Error común: `{ "error": { "code", "message", "requestId" } }`. Respuestas sin caché y con instrumentación.

| Método y ruta | Contrato |
| --- | --- |
| POST `/api/v1/checkout` | Header `Idempotency-Key`: 16–128 caracteres alfanuméricos, guion o guion bajo; JSON `{ "cartVersion": 1 }`. 200 `{data: pedido}` tanto al crear como al recuperar. La clave tiene alcance por usuario. |
| GET `/api/v1/orders?page=1` | `{data:{items, page, hasNext}}`; 20 por página, fecha descendente e ID como desempate. Página entera 1–99999. |
| GET `/api/v1/orders/[id]` | `{data: pedido}` propio; UUID inválido 400, inexistente o ajeno 404. |
| POST `/api/v1/payments/[id]/simulate` | JSON `{ "scenario": "approved" }`; solo pago propio SIMULATED y modo servidor simulado. Escenario durable, no se modifica al repetir una operación. |
| POST `/api/v1/orders/[id]/reconcile` | Sin cuerpo requerido; consulta estado y aplica las mismas reglas de confirmación. No crea cargos. |
| GET/POST `/api/v1/payments/webpay/return` | `token_ws` confirma un pago pendiente; `TBK_TOKEN` o par TBK_ORDEN_COMPRA/TBK_ID_SESION solo consultan. Nunca se confía en el estado indicado por el navegador. Retorno válido redirige 303 al detalle privado. |

Pedido: id, status, totalClp, currency CLP, createdAt ISO, items (productId, name, unitPriceClp, quantity, subtotalClp), payment (id, provider, status, providerState, reversalResult, canResume, canSimulate). Nunca contiene token, sesión externa, claves, hash o tarjetas. La página privada `/pedidos/[id]/pagar` presenta un formulario POST con el token exclusivamente al host permitido de integración.

Escenarios admitidos: approved, rejected, cancelled, timeout, timeout-approved, reversal-failed, reversal-timeout. Un pago ya definitivo devuelve su estado sin repetir operaciones. Conflictos 409: CART_CONFLICT, IDEMPOTENCY_CONFLICT, ORDER_PENDING, STOCK_CONFLICT, PAYMENT_PROCESSING; 401 sin sesión, 403 origen inválido, 429 límite del proveedor, 503 configuración insegura. Un rechazo o cancelación comercial es un resultado 200 con estado explícito, no un error de infraestructura. Un timeout queda indeterminado y también retorna su estado; medir ambos campos al evaluar resultados futuros.

Para preparar futuras pruebas: obtener CSRF y sesión de Auth.js, llenar carrito usando If-Match, consultar su versión, crear pedido con una clave nueva por intención y conservarla en reintentos. Simular, consultar y registrar requestId/Server-Timing y estados comerciales. Mantener PAYMENT_PROVIDER=simulated. Todavía no hay scripts k6.
