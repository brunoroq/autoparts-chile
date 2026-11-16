# Auditoría de compra k6 — prueba funcional única, 2026-11-16

## Veredicto
**CUMPLIDO FUNCIONALMENTE:** recorrido autenticación → producto → carrito → checkout → pago simulado → verificación. Una ejecución, unVU, una compra; no ensayo de capacidad ni de compra concurrente.
Experimento: 206d0db0-457c-48a6-a93b-dc93e0a95b71.
Entorno: a52a7a92-9b7f-4ae1-a6cf-643a0a25f14f, http://127.0.0.1:3102, autoparts_purchase_test.
No atribuir esta compra al script8ebe47a deMatías ni mezclar sus métricas con históricos3/10/30 o pruebas10/500 anteriores.

## Ejecución
Se repitió preflight completo, RAM3,90GiB libre, marcador exacto, proveedorSIMULATED, Analyticsfalse/IDs vacíos. SELECT inicial0pedidos/0pagos/0líneascarrito,10usuarios.
Se ejecutó exactamente una vez el comando autorizado perf:purchase:once, con el archivo privado del entorno. Cuenta derivada solo enmemoria, no contraseñas enargv o resultados.
Planreal:1VU/1compra/100solicitudesmáximo/90segundosmáximo. Exit0,stoppedfalse; no reintentos ni cambios de código/configuración.

## Persistencia comprobada por SELECT
|Dato|Resultado|
|---|---|
|Pedido|73b36e31-7ff0-46a5-bb22-a848d96c7862,PAID|
|Pago|SIMULATED/APPROVED/AUTHORIZED|
|Importe ycantidad|6990CLP,1unidad|
|SKU|AP-SEED-00002|
|Stock|22→21|
|Precio|6990→6990CLP,sincambio|
|Conteosfinales|1pedido,1pago,0líneascarrito|
|Otrosdatos|30productos,precios/identidad/activo/categorías/usuarios/carritos sin cambios,exceptostockdeeseSKU|

No se utilizó el productoWebpay de24990CLP: el recorrido seleccionó dinámicamente un producto disponible desde elservidor. No se accedió a la baseWebpay ni se repitió sucompra.

## Métricas reales
|Indicador|Valor|
|---|---:|
|Solicitudes k6|17|
|PreflightHTTPdelrunner,fuera métricas k6|1|
|Respuestas200/201|16/1|
|ErroresHTTP4xx/5xx/red|0|
|Fallosfuncionales|0|
|Recorridoscompletados|1|
|Duraciónrecorrido|611ms|
|Duracióniteración|611,7395ms|
|Ventana plan→finrunner,derivada timestamps|1280ms|
|Throughputnominalk6|27,7166req/s|
|LatenciaHTTPpromedio|34,6932ms|
|Mediana|9,1187ms|
|p90|47,3003ms|
|p95|120,2082ms|
|p99|298,7627ms|

Incluyeautenticación ymarcadores dentro de las17solicitudes. No representa throughput sostenible ni distribución estadísticamente estable. Los percentiles se basan en17HTTP; solo hay1observación de recorrido. Elpreflightmanualprevio es preparación, no parte delresumenk6.
POST realesregistrados:1login,1addcart,1checkout,1simulate. GET consultaron marcadores,CSRF,sesión,productos,carrito ypedido. SinGA4nipagosWebpay.

## Integridad y restricciones
Huella inicial de30productos ymetadatosdecontenedores guardada antesdeejecutar. Comparaciones posteriores de estado/pago/stock ymetadatosprotegidos aprobadas.
Los trescontenedores protegidos conservanId/imagen/estado/StartedAt/reinicios/montajes/puertos. Ya estaban detenidos; no se arrancaron.
Código delrunner/recorrido/política/preflight coincide con sus hashes previos.
No se accedió a basesexternas. No se afirma auditoría remota de sus contenidos: la ausencia de operaciones se respalda en configuraciónaislada,destinofijo yfuente revisada.
EtiquetasURLdelJSONL normalizadas como rutas relativas; no son capturaindependientedered. Destino respaldado por plan,fuentefijaypreflight. Analytics apagado,proveedor simulado,redesDocker restringidas; sin solicitudesGA4/Transbank en recorrido.

## Incidencia de análisis, sin repetición
El primer posprocesador temporal falló conInvalidURL al intentar tratar una etiqueta relativa como URLabsoluta, DESPUÉS de que pasaran las comparaciones de datos,contenedores yfuente.
No fue un fallo de k6 ni de pago; no se corrigió código deaplicación/runner ni se repitió la ejecución. Se leyeron las métricas de los originales y se conservó la limitación deatribución por etiquetas.
No hay pendiente repararpedido o inventario. Cualquier mejora delposprocesado requiere revisiónseparada.

## Fuentes locales conservadas
- artifacts/purchase-results/206d0db0-457c-48a6-a93b-dc93e0a95b71/: k6.csv,k6.jsonl,summary.json,plan.json,outcome.json.
- artifacts/purchase-verification/functional-once-20261116/: before.json,verification.json,sha256.json.
Siete fuentes tienenSHA256 calculado y revalidado. Archivo de hashes vincula bytes/origen exactos. Sin credenciales/tokens/JWT detectados en los originales mediante barrido textual; no publicar carpeta deenvprivado.
Estos artifacts están ignorados porGit y todavía NO accesibles alprofesor mediante enlaceexterno.
Los datosraw permanecen intactos; no se ejecutaron cargas adicionales ni commit/push.

## Matriz de alcance
|Requisito|Estado|
|---|---|
|Fase1.2comportamientocompra|CUMPLIDO funcionalmente para este nuevo recorrido|
|Autenticación/carrito/checkout/simulación/persistencia|CUMPLIDO en una prueba real local|
|Idempotencia bajo concurrencia|NO acreditada por esta ejecución; coberturaoffline separada|
|Carga de comprasnormal/pico|NO ejecutada ni autorizada|
|GA4medición deesta compra|NO APLICA a esta prueba: desactivado intencionalmente|
|Publicación de código yresultados paraentrega|PENDIENTE autorización y empaquetado|

## Complemento autorizado: diez compras concurrentes

Experimento `635f372f-a8bb-45f8-b97e-4584aec6dd02`: diez VUs, diez compras nuevas PAID y diez pagos SIMULATED/APPROVED/AUTHORIZED; 140 HTTP k6, cero errores. Autenticación secuencial previa separada: 40 solicitudes y 3.118 ms. Stock AP-SEED-00002 de 21 a 11; carritos vacíos; pedido original intacto. Evidencia y limitaciones en [resultados concurrentes](performance/purchase-concurrent-results-20261116.md).

Queda CUMPLIDO el recorrido funcional concurrente acotado de diez compras independientes. Continúan sin acreditarse reenvíos de una misma clave bajo concurrencia, agotamiento de última unidad y capacidad sostenida. No se ejecutaron otras cargas, pagos externos ni cambios de infraestructura. Originales y hashes locales conservados; publicación para la entrega sigue pendiente.
