# Compra simulada k6: preparación offline

## Cierre vigente — 2026-11-16

Las secciones siguientes conservan la cronología de preparación y no describen todas el estado actual. Ya se completaron una compra de 1 VU y diez compras concurrentes de 10 VUs. Las ejecuciones de esta etapa están finalizadas; no repetir comandos históricos. Consultar [auditoría de resultados](../auditoria-compra-k6-2026-11-16.md), [resultados concurrentes](purchase-concurrent-results-20261116.md) y [revisión para integrar](purchase-integration-review-20261116.md). Autenticación actual: preparación secuencial en Node, cookies en memoria por VU y métricas separadas de k6; sustituye la descripción inicial de login dentro del recorrido. Publicación e integración aún no autorizadas.

## Estado y procedencia
Worktree: autoparts-k6-purchase-safe. Rama: feature/k6-purchase-safe.
Base exacta: 40829fafa99fefa35142fd368696191e7b4d3eea. Conserva la corrección de instrumentResponse.
Trabajo independiente inspirado en el aporte de Matías Ponce (8ebe47a): recorridos HTTP y separación del análisis aplicación/Analytics. No se importó ni cherry-pickeó ese commit, porque incluye un API secret y envíos directos a la propiedad oficial.
No se cambió autoría ni historial. No se incorporaron el secreto, los POST a Google, defaults inseguros de .env.example, console.error bruto ni los límites500/250000.
La rama actual conserva navegación3/10/30VU y10000solicitudes. La compra es un modo nuevo con políticas independientes.
No hay cargas nuevas, compras reales, migraciones, bases preparadas ni resultados de desempeño obtenidos con este código.

## Recorrido y contratos existentes
1. GET del marcador /api/performance/status: entorno de compra válido, UUID correcto, puerto3102, BD exclusiva, SIMULATED y Analyticsfalse.
2. GET /api/auth/csrf y POST /api/auth/callback/credentials porformulario. Cookiejar independiente porVU mediante k6. GET /api/auth/session confirma usuario.
3. GET /api/v1/cart exige carrito vacío y versión entera; GET productos/lista/detalle busca producto con stock superior al presupuesto máximo de compras.
4. POST /api/v1/cart/items {productId,quantity:1} y If-Match con la versión entre comillas. Espera201 y usa precio/total/versión del servidor.
5. POST /api/v1/checkout {cartVersion}, con Idempotency-Key determinista UUIDdeejecución+ordinalúnico. Espera PENDING y providerSIMULATED.
6. POST /api/v1/payments/[id]/simulate {scenario:"approved"}: verifica PAID,APPROVED,AUTHORIZED.
7. GET pedido,carrito yproducto: verifica cantidad1,producto,precio,total,carritovacío ystockdecreciente. Concurrencia: no atribuir stockfinal=stockinicial−1 si otroscompradores compartenSKU; la validación admite descuentos adicionales y jamás incrementos/reposiciones.
El marcador se vuelve a validar antes de CADA POST, incluida autenticación.
Ningún POST se reintenta. Timeout/5xx detiene toda la ejecución. Si quedó carrito/pedido pendiente, revisar luego con lectura; no limpiar ni conciliar automáticamente.
Este flujo no usa compra invitada, Webpay, callback, registro de usuarios ni mergeGuestCart. No cambia los módulos de negocio.

## Límites y aislamiento
|Control|Valor|
|---|---|
|Destino único|http://127.0.0.1:3102|
|Contenedores requeridos|autoparts-purchase-app y autoparts-purchase-postgres, saludables, label autoparts.scope=purchase-test|
|Base efectiva|postgresql en purchase-postgres:5432/autoparts_purchase_test; DIRECT_URL igual si se define|
|PostgreSQL|sin puertos publicados; red autoparts-purchase_lab|
|Aplicación|único puerto publicado127.0.0.1:3102|
|Red de laboratorio|internal:true|
|Red de ingreso|masquerade:false; sin redes adicionales|
|Proveedor|simulated; WEBPAY_ENVIRONMENT=integration|
|Analytics|false, ambos IDs vacíos, sin observador; tráfico synthetic|
|Default|1VU,1compra,100solicitudes,90segundos|
|Máximos compra|10VU,10compras,500solicitudes,120segundos|
|Presupuesto|partición porVU; incluye auth,marcadores yverificación; reserva1para preflight delrunner|
|Paradas|plan caducado,timeout,error,aislamiento incorrecto,RAMhost<2GiB,watchdogal deadline,interrupción|
|Redirecciones|ninguna se sigue|
|Ejecución directa|sinplan y marca delrunner, rechazoantes de HTTP|

El marcador se valida desde configuración del servidor, no solo desde el plan del cliente. El runner inspeccionará los dos contenedores y redes antes de HTTP.
Las comprobaciones reducen ejecuciones accidentales fuera del laboratorio; no son una barrera contra alguien que edite el código o simule deliberadamente todos los controles.
No se habilita una URL arbitraria ni se amplían los permisos de navegación del laboratorio3100. Los servicios3100/3004 siguen intactos.
Credenciales futuras porstdin alrunner y entorno efímero delhijo, únicamente memoria; no se guardan ni imprimen. No usar contraseña comoargumento de shell ni activar HTTPdebug. Las cuentas deben ser exclusivas, distintasporVU, y estar preparadas con autorización. No crearcuentas poriteración. El presupuesto máximo10compras también acota logins; no se desactivan limitadores.

## Métricas y salidas futuras
Navegación continúa en journeys.js, sinGA4, con sus resultados históricos intactos.
Compra usa workload=purchase, rutas normalizadas y fase authentication/transaction.
Se exportan k6.jsonl,k6.csv,summary.json,outcome.json yplan.json a un directorio nuevo artifacts/purchase-results/UUID, sin sobrescritura.
Incluye http_req_duration avg,med,p90,p95,p99,throughputHTTP,estadosHTTP,errores técnicos/conflictoscomerciales,comprascompletadas ypurchase_journey_ms.
purchase_db_ms,purchase_app_ms,purchase_provider_ms provienen deServer-Timing; no atribuir dbms exclusivamente al motorPostgreSQL.
Auth ymarcadores están en el total de solicitudes; filtrar fases/rutas para analizar transacción. Eltiempo completo delrecorrido incluyeauth.
No envía eventos aGoogle ni mezclaGA4con HTTPdeaplicación. Elsecretoremoto debe revocarse manualmente: este trabajo local no invalida lo publicado.

## Comandos (no ejecutan carga)
- npm test
- npm run lint
- npm run typecheck, usando configuración local ficticia de generación, sin conexión.
- npm run perf:purchase -- plan --environment-id UUID_DEL_LAB
El modo plan solo produce dryRun yplan enstdout; no invocaDocker,k6 oHTTP. Guardar posteriormente solo el objeto plan en artifacts/purchase/plan.json, nunca credenciales, y generar plan nuevo porque caduca.

La ejecución real exige run --plan-file ... --execute --accept-test-writes y cuentasporstdin. **No está autorizada ahora.**
No se entrega comando copiable con credenciales ni se inicia una ejecución con este documento.

## Qué falta para 3102 (otra autorización)
- CrearCompose propio cumpliendo nombres,labels,aliasDNS purchase-postgres,redes,healthchecks,topesCPU/RAM ypuerto de esta política.
- Base NUEVA exclusiva autoparts_purchase_test,volumen propio; aplicar migraciones existentes ycatálogo de prueba solo tras verificar destino. No reutilizar3004 ni3100 niNeon.
- Preparar pool pequeño de cuentas y stock conforme al presupuesto, con secretos privados; no reutilizar cuentas sandbox.
- Probar el aislamiento y egreso real, acceder desdeWindows y confirmar que no hay otros servicios en las redes nuevas.
- Ejecutar preflight con autorización y después una única compra1VU/1iteración, también con autorización separada.
- Decidir por separado la rotación del secretoGA4 y tratamiento de historial.
- Antesdepublicar esta rama, decidir política dePreviewVercel: no es necesaria para ejecutar k6 localmente.

## Pruebas offline
purchase-performance.test.ts sustituye por completo transporte, marcadores y estado de carrito/pedido. La VM prueba el adaptador k6 con módulos falsos: no ejecuta el binario k6 ni solicitudesHTTP.
Cubre contratos, presupuestos, listado de rutas, planes vencidos/remotos, providerexterno,GA4activo,puertos públicos,PostgreSQLpublicado ytimeout sin duplicación.
Las fixtures son datos sintéticos enmemoria, no compras ni credenciales reales. La prueba no valida concurrencia realPostgreSQL ni una sesión contra un servidor.
La integración real y la idempotencia durable siguen pendientes de prueba autorizada en la futuraBD; no se marcan comoejecutadas.
## Verificación de esta preparación — 2026-11-16
- npm test: **52/52 aprobadas**, incluidas8nuevas decompra.
- npm run lint: aprobado.
- npm run typecheck: aprobado, con URL ficticia loopbackpuerto1,telemetríaNext ycomprobaciónactualizacionesPrisma desactivadas. Solo generaciónlocal, sinconexiónDB.
- git diff --check: aprobado; avisosLF/CRLF no son errores.
- Barrido de referencias de secretosincrustados en archivosdelworktree:sincoincidencias. No se importó ningún secreto delcommit8ebe47a.
- PruebaVMdeladaptador: uncheckout yunasimulación exclusivamente en memoria. No ejecucióndelk6binario niHTTP.
- ErroresinicialesdeTypeScript(ProcessEnv ytipoPuertosfixture) corregidos. Unassertdeobjetos deVM falló porprototiposdeotroreino,corregido normalizandodatosdeldoble; versiónfinalaprobada.
- HEAD delworktreenuevo continúa40829fa,sincommit. WorktreeoriginalconsultadosoloparaverificarHEADypendientes,sin alterarlos.
- No build: autorización solicitó únicamente pruebasoffline,lint yTypeScript.
Listo para revisión de seguridad offline. No listo para ejecutar antes de preparar3102,preflightreal yautorizaciónseparada.

## Intento de preparación 2026-11-16T19:08:17.3686927-03:00
Bloqueado antes de crear recursos: Docker Engine Linux no disponible; falta tubería dockerDesktopLinuxEngine. RAM Windows libre8,09GiB. No se crearon Compose, contenedores, volúmenes, bases, cuentas ni secretos. No migraciones,seed,compras o k6. Estado3004/3100no verificable; no se operó sobre ellos. Se requiere iniciar Docker Desktop manualmente y esperar motorLinux para repetir preflight. No hay UUIDreal de laboratorio ni comando final válido todavía.
## Estado operativo vigente — 2026-11-16
**Preparación completada. Preflight aprobado; k6 y compras todavía no ejecutados.**

- UUID del entorno: a52a7a92-9b7f-4ae1-a6cf-643a0a25f14f.
- Aplicación: http://127.0.0.1:3102, HTTP200 y healthcheck healthy.
- Contenedores: autoparts-purchase-app / autoparts-purchase-postgres, ambos healthy y0reinicios.
- Base nueva autoparts_purchase_test, PostgreSQL18.6,7migraciones completas/0incompletas.
- 30productos,6categorías,10cuentas exclusivas,10carritos vacíos,0pedidos,0pagos.
- AP-SEED-00001:24990CLP/stock5. Solo fixtures nuevos; no se leyó o cambió stockWebpay.
- Proveedor simulated. Analyticsfalse,ambosIDsvacíos,debugfalse. HTML público y configuraciónDocker comprobados.
- PostgreSQL sin puerto host. Aplicación solo127.0.0.1:3102. Labinternal yredingresosinmasquerade.
- Volumen exclusivo autoparts-purchase-a52a7a92-9b7f-4ae1-a6cf-643a0a25f14f.
- App2CPU/1,5GiB; PostgreSQL1CPU/512MiB. DockerLinux12CPU/8290881536bytes asignados.
- RAMWindows5,06GiB previa;4,60GiB enpreflight. Muestra puntual posterior: app56,27MiB/0,31%CPU;PG78,69MiB/5,72%CPU. Son datos de preparación/idle, no resultado de carga.
- Imagen autoparts-purchase:local construida desde autoparts-performance:local con --network=none; no descargas de dependencias. Build yTypeScript de imagen aprobados.
- Lint,tipo y53/53pruebasoffline aprobados. Preparaciónreal autorizada no creó pedidos ni pagos.
- Credencialesnuevasprivadas en artifacts/purchase-lab/UUID/compose.env, ACLrestringida e ignorado porGit. Contraseñas de cuentas derivadas enmemoria porHMAC delsecreto local; enBDsolo hashes scrypt. No archivo de contraseñas. Primera cuenta verificada porlectura/hash, sin login.
- Los contenedores deperformance yPGWebpay ya estaban detenidos al volverDocker; se preservaron detenidos. Comparación antes/después de ID,imagen,estado,StartedAt,reinicios,montajes ypuertos sin diferencias. No se iniciaron otrosservicios.
- La comprobaciónGitdesdeusuarioelevado reportó dubiousownership; se repitió solo gitcheckignore con el propietario delworktree. No se cambió safe.directory ni permisosglobales.

[Resultado saneado de preflight](purchase-lab-preflight-2026-11-16.json).
Snapshot protegido y configuraciónprivada permanecen locales/ignorados; nunca anexar compose.env.

### Comando propuesto para después (NO ejecutado)
Desde autoparts-k6-purchase-safe, con autorización explícita de una compra:

    npm run perf:purchase:once -- --env-file artifacts/purchase-lab/a52a7a92-9b7f-4ae1-a6cf-643a0a25f14f/compose.env --execute --accept-test-writes

El helper genera un plan NUEVO y vigente,1VU/1compra/100solicitudesmáximo/90segundos,deriva la cuenta enmemoria ylaenvía porstdin alrunner. Preflight obligatorio antesdek6, sin claves enargv/logs/archivosdecuentas.
No ejecutar comandos de run deldocumento anterior ni preparar de nuevo elcatálogo. El preparador rechaza una base que ya tenga tablas para evitar reseed/repetición accidental.
Cualquier timeout detiene el recorrido sin repetirPOST. Consultar soloGET/SELECT antes de decidir acciones posteriores.

### Detención futura, no ejecutada
Después de guardar evidencias y con autorización: docker compose con este compose/env stop app purchase-postgres.
No usar down-v,prune ni borrarvolúmenes. La limpieza coneliminación requiere otra autorización y respaldo/evidencia previa.

## Primera ejecución funcional autorizada — 2026-11-16
Experimento206d0db0-457c-48a6-a93b-dc93e0a95b71,exit0,1VU/1comprarealdesimulador,17HTTP,0errores. PersistenciaSELECT:1pedidoPAID/1pagoSIMULATEDAPPROVEDAUTHORIZED/6990CLP/SKUAP-SEED-00002stock22→21/carritovacío. No repetir el comando: el laboratorio ya no está vacío. Ver docs/auditoria-compra-k6-2026-11-16.md para métricas,fuentes,hashes ylimitaciones. Soloestaejecución; sin compras adicionales autorizadas.
