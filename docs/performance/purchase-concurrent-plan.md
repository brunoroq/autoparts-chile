# Preparación de compras concurrentes — 2026-11-16

## Decisión
**GO condicionado a autorización explícita y preflight actualizado. No se ejecutó k6.**
Alcance propuesto:10VU,10compras máximo,500solicitudes totales máximo y90segundos globales desde generación delplan.
No se cambió la instanciaDocker ni se reiniciaron laboratorios. Únicamente código,tests,documentación y lecturasSQL acotadas de3102.

## Inventario verificado
- Diez usuarios distintos con diezcarritos distintos; cero usuarios sincarrito y cero líneascarrito.
- Existe unpedido yunpago previos,PAID/SIMULATED/APPROVED/AUTHORIZED por6990CLP. No se alteró.
- AP-SEED-00002 activo,stock21 yprecio6990CLP. Aun si las10compras usan eseSKU, quedarían11unidades; otrosproductos también tienenstock>10.
- El recorrido escoge delservidor productos con stock superior alpresupuestomáximo. Repetir lectura antesdeejecutar; la disponibilidad actual no garantiza futuro anteotroactor.
- CadaVU recibe una cuenta,una sesión yuncarrito propios. Puede reutilizarse la cuenta de laprimera prueba con unpedido NUEVO yclave NUEVA; nunca se reutilizan pedido/pago previos.
- Las sietehuellas de la primera prueba siguen coincidiendo.

## Posprocesador reproducible
scripts/purchase-analysis.ts acepta rutas relativas yURLsabsolutas delorigenlocal autorizado,normalizaUUID y rechaza terceros,protocol-relative,credenciales/querystrings y rutas fuera delcontrato.
Marca relative_label_only cuando no hay origenobservado. Nunca inventa una dirección de red a partir de etiqueta relativa.
scripts/analyze-purchase.ts lee originales y crea otrodirectorio; no sobrescribe,ni corrige archivosfuente.
Reprocesado offline exitoso de las17solicitudes previas:
artifacts/purchase-verification/relative-label-analysis-20261116/{analysis.json,originals-sha256.json}.
Runner futuro exporta analysis.json youtcome.analysisValid; unerror de análisis no causa repetición decompra.

## Autenticación para10VU
Hay uncontrol real de máximodos hashes scrypt activos. Por eso, elrunner preparará sesiones **secuencialmente** antes de la fase k6.
Para cada cuenta:GETcsrf,GETmarcador,POSTcredentials,GETsession. Valida correo y usuario únicos; cookies soloenmemoria,jar separado ytransferencia alVU correspondiente. No se desactivanCSRF,limitadores ni hash.
La fase concurrente empieza después, con10VU/per-vu-iterations1. Verifica sesión de nuevo,carrito vacío/versión,producto,checkout,simulación ypedido.
Si authfalla, no se lanza k6. No nuevos usuarios ni registros necesarios.
Las métricas de login Node se guardan como authDurationMs ysetupRequests, fuera de los percentilesHTTPdek6. No comparar directamente con la primera compra, cuyo login estaba dentrodek6.
Presupuesto:40HTTPauth+1preflight+140HTTPk6 esperadas=181 solicitudes aproximadas según caminoexitoso, no medición. Tope estricto500 mediante reserva ypartición. El GETmanualpreparatorio se documenta aparte.
El watchdog global descuenta tiempoauth: no añade90segundos despuésdelsetup.

## Comando propuesto, NO ejecutado
Desde autoparts-k6-purchase-safe:

    npm run perf:purchase:once -- --env-file artifacts/purchase-lab/a52a7a92-9b7f-4ae1-a6cf-643a0a25f14f/compose.env --execute --accept-test-writes --vus 10

Elhelper generaUUIDnuevo,10cuentasderivadas enmemoria,10compras yplan500requests/90s. Sinflagvusmantiene1VU. Rechaza otrosvalores deesehelper; política general conserva máximos10/10/500/120.
No ejecutar sinautorización; nousar unplan viejo/caducado.

## Antes y después
Antes:preflightcontenedores/red/puertos/origenUUID/providerSIMULATED/GAoff/RAM>=2GiB; confirmar10cuentas/carritosvacíos,1pedido+1pago previos ystock; guardarfingerprint completo ySHAdeprimeraprueba.
Después,soloGET/SELECT:
- Esperar10nuevospedidosPAID y10pagosSIMULATEDAPPROVEDAUTHORIZED (totales11/11),uno porcada comprador,con10keys distintas.
- Pedido anterior conservaestado,importe,items,pago yfechasguardadas; no usarlo para aprobarni reconciliar.
- CartItem0; usuarios/cuentas sincrearotros.
- PorSKU: stockfinal=stockinicial−sumacantidades de nuevos pedidosPAID; suma total de decrementos10. Precios/categorías/productos sin cambios.
- ContarHTTP4xx/5xx,red,conflict409,timeout,completados,setup ytransacción separados. Verificarcheckscódigoexit yanalysisValid.
- Guardar originalesJSON/CSV/JSONL yhashes en carpetanueva; confirmarhashes históricos.
- Antecualquierresultadoincierto,detener ysololecturas. No POSTdereintento,limpieza,reconciliación orestock automáticos.

## Verificación offline y límites
55/55pruebas,lint yTypeScript aprobados. Regresión de etiquetasrelativas/absolutas/bloqueoexterno; prueba secuencial10sesiones/40llamadas/concurrenciaauth1/cookiesdistintas ytimeout sinretry; VMdeladaptadork6 sinservidor.
No compras reales nuevas ni sesiones reales preparadas duranteesta tarea.
Pendientes reales: validar transferencia de cookies Node→k6 yconcurrencia de10transacciones en la próxima ejecución autorizada. Pruebasoffline no prueban esos efectos sobrePostgreSQL.
El loginsecuncial reduce elriesgo429porhash; no promete ausencia de conflictos/timeouts bajo recursosreales. La prueba debe detenerse sinreintentar si ocurre.
GA4 yTransbank permanecen fuera delrecorrido; secretosremotos ysu revocación no se modificaron aquí.