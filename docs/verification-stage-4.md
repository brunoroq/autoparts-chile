# Verificación de etapa 4

Fecha local: 4 de noviembre de 2026, America/Santiago. Node 24.21.0, npm 11.19.0, Next 16.4.5, React 19.3.1, TypeScript 5.9.3, Prisma 7.10.1, ESLint 9.39.5 y PostgreSQL 17.11 en Docker/WSL2. SDK nuevo: transbank-sdk 6.1.1. Sin cambios forzados del stack.

## Evidencia funcional

- 13 pruebas unitarias exitosas: catálogo, autenticación, validaciones de checkout, configuración segura, cifrado autenticado y adaptador Webpay sin red.
- Integración PostgreSQL: snapshots/precios del servidor, idempotencia concurrente, versiones y stock, aislamiento, última unidad, duplicación, rechazos/cancelaciones/timeouts, recuperación y reversas. Se añadieron rollback de varias líneas y create indeterminado para la ronda final.
- Regresión PostgreSQL de usuarios/carrito y catálogo/seed hasta 10.000 productos, ambas exitosas en bases aisladas.
- HTTP: recorrido compuesto de checkout, cuatro pruebas de autenticación/carrito y tres de catálogo exitosos. Sesión real, autorización, Origin, idempotencia, validaciones y métricas. Conflictos 409 verificados además en servicios concurrentes.
- Navegador Chrome: 12 pruebas exitosas, seis recorridos por escritorio 1440×1000 y móvil 390×844. Catálogo, teclado, sesión, carrito, conflictos entre pestañas y compra timeout-aprobada con recarga, reconciliación e historial. Sin desbordamiento; captura del detalle revisada visualmente. Evidencia ignorada en test-results.
- Reinicio real en puerto 3105: crear pago UNKNOWN, detener/reiniciar Next.js, consultar y confirmar una sola vez, logout/login e historial persistente. Logs capturados sin secretos conocidos.
- Lint, tipos, Prisma y build exitosos durante la implementación. Auditoría de producción: cero vulnerabilidades.

No se ejecutó una compra real en Webpay de integración. Se inspeccionaron tipos/métodos del SDK y se probaron el adaptador con transporte controlado y las reglas con PostgreSQL real. Esto no certifica el servicio externo. Seguir [pasos manuales](stage-4.md) para completar esa evidencia.

## Aislamiento y reproducción

Las escrituras de checkout usan autoparts_checkout_test, con 30 productos semilla y fixtures aleatorios adicionales, sin limpieza automática. Regresión en autoparts_auth_test y autoparts_catalog_test. La base habitual no recibe usuarios/pedidos ficticios de estas pruebas.

Preparar: npm run test:checkout:prepare. Ejecutar npm test, npm run test:checkout:integration y npm run test:checkout:restart. Validar con npm run validate. Detener servidores antes de npm run build. Después iniciar en terminales separadas npm start (3000), npm run test:auth:server (3002) y npm run test:checkout:server (3004). En la terminal de pruebas ejecutar test:checkout:http, test:auth:http, test:http, test:browser y check:http mediante npm run. Los servidores aislados fijan simulador; los transportes falsos se inyectan solo por código de prueba.

## Problemas y decisiones

- Un servidor anterior ocupaba 3000. Reconstruir con él activo mezcló archivos del build y produjo fallos de regresión visual. Se detuvo, reinició y la suite de 12 pasó. Detener todos los servidores que compartan .next antes de compilar.
- La prueba HTTP esperaba 200 al agregar al carrito; el contrato existente devuelve correctamente 201. Se corrigió la aserción.
- PowerShell antiguo alteró caracteres acentuados al generar archivos. Se corrigió UTF-8 y se revisaron textos nuevos y prompt completo. No se reescribieron entradas históricas.
- Prettier temporal no reconoce Prisma sin plugin; se usó prisma format, sin dependencias permanentes de formato.
- Reversa incierta permanece en revisión y no se repite al consultar. No se promete resolver pérdidas de token/secreto ni operaciones financieras automáticamente.

## Archivos

Nuevos: módulos orders (service/validation/labels), payments/providers, componentes CheckoutView/PaymentActions; páginas checkout, historial, detalle y formulario Webpay; rutas REST; migración aditiva; pruebas unitarias/Prisma/HTTP/navegador; helper de base aislada y scripts de preparación, servidor y reinicio; documentos de etapa, API y verificación.

Modificados: schema.prisma, package.json/lockfile, .env.example, next.config.ts, instrumentación, carrito, header/footer y estilos; AGENTS.md, LogFile.txt, README, arquitectura, base, plan y decisiones. Credenciales, .env, node_modules, cliente generado, .next y test-results permanecen ignorados. Sin commit, push, despliegue, GA4 ni k6.

La ronda final posterior a los últimos ajustes se anexa al cierre.

## Cierre de la ronda final

2026-11-04T23:49:43.901-03:00: validate (lint, TypeScript y Prisma) y build de producción exitosos. 13 unitarias, 10 integraciones de checkout, 8 HTTP (1 checkout, 4 auth/carrito, 3 catálogo) y smoke HTTP 200 exitosos. Recuperación tras reiniciar proceso repetida con build final, sin secretos conocidos en logs. Regresiones PostgreSQL previas de catálogo/seed y usuarios/carrito exitosas. Docker healthy; conexión Prisma real correcta. Base habitual: 0 usuarios, 6 categorías, 30 productos, 0 carritos, pedidos o pagos. Auditoría de 195 archivos revisables sin secretos locales conocidos ni rutas excluidas; enlaces locales válidos y git diff --check correcto. La última suite de navegador se registra en LogFile al finalizar.

Corrección de reproducibilidad: una repetición del navegador agotó el producto semilla fijo utilizado por compras anteriores en autoparts_checkout_test. Los tests de navegador de checkout y reinicio ahora crean un producto propio con stock acotado por ejecución, sin reponer existencias ni borrar fixtures anteriores. La tienda habitual permanece intacta. Se repite la suite completa tras este ajuste.

Cierre final 2026-11-04T23:52:26.652-03:00: suite de navegador repetida con fixtures propios, 12/12 exitosas (34,8 s); reinicio real exitoso y logs sin secretos conocidos. Lint/TypeScript repetidos después del ajuste; build final exitoso. Total de casos de las suites verificadas: 13 unitarios + 10 integración checkout + 2 regresiones de integración + 8 HTTP + 12 navegador = 45, además de reinicio y smoke. Servidores aislados de 3002/3004 cerrados; tienda habitual reiniciada en 3000. Sin commit ni despliegue.

## Auditoría previa al commit autorizado por prompt 012

La integración con el sandbox oficial de Transbank todavía requiere una prueba manual completa. Los resultados automáticos del adaptador no sustituyen esa prueba. El usuario autorizó versionar la etapa 4 con esta limitación explícita; se repiten comprobaciones antes del commit. No se activará GA4 ni se implementará etapa 5 en este turno.

## Resultado previo al commit del 5 de noviembre de 2026

2026-11-05T13:32:08-03:00: verificación previa al commit de etapa 4 completada. validate (lint, TypeScript, Prisma) y build exitosos; 13 unitarias, 10 integraciones checkout, 2 integraciones de regresión (auth/carrito y catálogo/seed), 8 HTTP y 12 navegador: 45 pruebas exitosas. Reinicio real de proceso y smoke HTTP 200 correctos. Primera ejecución de integraciones falló por Docker Desktop apagado; se inició en segundo plano, se levantó el contenedor existente sin borrar datos y se repitieron las pruebas con resultado exitoso. PostgreSQL healthy. Auditoría de producción cero vulnerabilidades. Auditoría de 195 archivos revisables sin secretos locales conocidos, claves privadas ni rutas excluidas. Sandbox oficial de Transbank sigue pendiente de prueba manual; ninguna prueba automática lo contactó. Servidores de pruebas cerrados; tienda habitual activa en localhost:3000. Sin cambios de código durante este turno: solo documentación/registro de cierre. Se auditará el índice antes del commit. Hash y estado limpio se entregan en chat; no se modifican archivos después del commit para registrar su propio hash. Sin push, despliegue ni implementación de etapa 5.
