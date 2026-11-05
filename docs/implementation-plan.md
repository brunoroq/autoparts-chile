# Plan de implementación

Estado vigente, prompt 011: etapas 2/3 versionadas en `5c609ee`; etapa 4 autorizada e implementada, con [flujo documentado](stage-4.md) y [verificaciones](verification-stage-4.md). Las restricciones históricas de este documento se conservan como antecedentes; ya no impiden la implementación aprobada. Sin autorización de commit final, etapa 5, GA4, k6 o despliegue.

Estado al 4 de noviembre de 2026: etapas 0 y 1 completadas, commits `adbfa0e` y `4d224a6`. Etapa 2 aprobada e implementada según [propuesta concreta](stage-2-proposal.md); cambios sin commit para revisión. Etapa 3 y despliegues no autorizados.

El diseño de etapa 2 fue aprobado visualmente en prompt 008. [Etapa 3 propuesta](stage-3-proposal.md): solo planificación de usuarios/autenticación/carrito, pendiente de aprobación antes de implementar; sin autorización nueva de commit ni despliegue.

Actualización vigente, prompt 009: etapa 3 aprobada e implementada; [resultados](verification-stage-3.md). Compatibilidad NextAuth v4 comprobada antes de integrar. Etapas 2 y 3 sin commit; no hay autorización de etapa 4, despliegue o commit final.

Actualización de cierre, prompt 010: commit conjunto de etapas 2 y 3 autorizado después de auditoría y verificaciones. Propuesta de etapa 4 se entrega en chat tras el commit; sin archivos nuevos posteriores para mantener el repositorio limpio. No está autorizado implementar checkout/pagos, instalar SDK, GA4/k6 o desplegar. El hash de cierre se consulta en Git.

Cada etapa comienza con explicación de archivos, comportamiento y pruebas, y requiere aprobación del usuario. Al cerrar: ejecutar verificaciones disponibles, registrar resultado y preguntar por commit y despliegue. No avanzar automáticamente a la etapa siguiente.

| Etapa | Alcance | Criterio de aceptación |
| --- | --- | --- |
| 0: documentación | AGENTS, LogFile, README, requisitos, arquitectura, plan, decisiones y metodología | Documentos coherentes, enlaces válidos, prompts completos y ausencia de código de aplicación |
| 1: base técnica | Versiones compatibles, gestor de paquetes, Next.js/TypeScript/Tailwind, Prisma, PostgreSQL local con Compose, configuración de entorno y validaciones | Aplicación base compila; conexión real a PostgreSQL; comandos reproducibles documentados; ninguna funcionalidad de tienda añadida sin aprobación |
| 2: catálogo | Esquema y semillas 30/1.000/10.000, inicio, listado, filtros, búsqueda, detalle y API | Lecturas reales, paginación, interfaz adaptable y consultas verificadas con varios tamaños |
| 3: usuarios y carrito | Registro/login, autorización y carrito persistente | Pruebas de acceso y aislamiento entre usuarios; flujo básico de navegador |
| 4: compra | Pedidos, historial, simulador y Webpay de integración | Integridad de stock/totales, idempotencia, concurrencia y retornos; pruebas masivas bloqueadas para Webpay |
| 5: observabilidad | Completar logs, recursos, GA4 y Web Vitals | Eventos y métricas verificables; ausencia de secretos y duplicación de compras; configuración documentada |
| 6: evaluación | k6, baja/normal/pico, saturación, comparación local/cloud y optimizaciones | Resultados reproducibles, percentiles, errores, recursos y limitaciones explícitas |
| 7: entregables | Informes, evidencias, guion de videos y documentación final | Trazabilidad entre requisitos, experimentos, gráficos y conclusiones |

La instrumentación mínima de errores y tiempos se incorporará desde las primeras rutas reales; la etapa 5 completa su cobertura. No postergar toda la observabilidad hasta el final.

## Validación progresiva

- Etapa 0: inspección de archivos, enlaces y cobertura de requisitos. Pruebas de aplicación y compilación no aplican porque no existe código ni manifiesto de proyecto.
- Desde etapa 1: comandos documentados de lint, comprobación de tipos, pruebas disponibles y build; declarar individualmente cualquier bloqueo.
- Servicios con reglas: pruebas unitarias significativas.
- Persistencia y API: integración con PostgreSQL real y base de pruebas aislada; no depender solo de mocks.
- Recorridos esenciales: pruebas de navegador para catálogo, acceso y compra simulada.
- Medición: usar build de producción, no servidor de desarrollo; separar validación funcional de evaluación de capacidad.

## Decisiones pendientes antes de sus respectivas etapas

Versiones y lockfile definidos en etapa 1. Pendientes: estrategia de credenciales/sesiones de Auth.js; carrito anónimo; diseño visual final y recursos; contenedor de aplicación; proveedor cloud y observabilidad; contratos de API; transiciones de estados de pago y stock; cargas y umbrales. El esquema inicial no implementa esas reglas. Resolver cada decisión cuando sea necesaria, sin ampliar el alcance aprobado.

Cierre autorizado, prompt 012: versionar etapa 4 después de verificar estabilidad y secretos. Sandbox oficial de Transbank pendiente de prueba manual. Etapa 5 solo propuesta en chat tras el commit; no implementar antes de aprobación. Sin despliegue ni carga.

Estado vigente prompt 013: etapa 5 aprobada e implementada, con verificación y configuración documentadas en stage-5.md y verification-stage-5.md. No activar propiedad real/accesos externos, no hacer commit ni comenzar etapa 6 sin nueva autorización.

Prompt 015: preparada compatibilidad Vercel/Neon, verificada en bases locales nuevas. No ejecutar migraciones/bootstrap cloud, commits, push o despliegue antes de autorización nueva. Etapa 5 sigue implementada y sin commit; separar su cierre del delta de despliegue según commit-plan-stage5-deployment.md.

Cierre prompt 016: etapa 5 y preparación Vercel/Neon versionadas en dos commits locales separados. No avanzar: Neon manual, migraciones/bootstrap remotos, push y despliegue siguen pendientes de autorización. Consultar Git para hashes.
