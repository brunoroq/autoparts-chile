# Plan de implementación

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

Versiones compatibles y lockfile; estrategia de credenciales/sesiones de Auth.js; comportamiento del carrito anónimo; diseño visual y recursos; contenedor de aplicación; proveedor cloud y observabilidad; contratos de API; estados de pago y stock; valores concretos de cargas y umbrales. Resolver cada decisión cuando sea necesaria, sin ampliar el alcance aprobado.
