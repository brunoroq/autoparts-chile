# Registro de decisiones técnicas

Registrar decisiones importantes con fecha, estado, contexto, decisión y consecuencias. Una tabla basta mientras el proyecto sea pequeño; crear documentos separados solo si una decisión requiere más detalle. Las propuestas pendientes no equivalen a implementaciones aprobadas.

| ID y fecha | Estado | Contexto y decisión | Consecuencias |
| --- | --- | --- | --- |
| D001 - 2026-11-04 | Aprobada | Usar un monolito modular Next.js y PostgreSQL; priorizar medición y simplicidad | Servicios compartidos; sin microservicios ni capas vacías |
| D002 - 2026-11-04 | Aprobada | Mantener el stack indicado por el usuario; verificar versiones al inicializar | Sin instalaciones ni versiones arbitrarias en etapa 0 |
| D003 - 2026-11-04 | Aprobada | Separar Webpay de integración y simulador mediante un proveedor de pagos | Carga masiva solo simulada; mismas reglas de negocio y persistencia |
| D004 - 2026-11-04 | Aprobada | Usar catálogos reproducibles de 30, 1.000 y 10.000 productos | Comparar consultas con distribución y semilla registradas |
| D005 - 2026-11-04 | Propuesta para etapa 1 | Usar Docker Compose para PostgreSQL; contenerizar la app solo si resulta conveniente | Reproducción local sencilla; no se crea infraestructura todavía |
| D006 - 2026-11-04 | Aprobada | Evaluar local y cloud gratuito como infraestructuras distintas | Registrar cuotas, topología y recursos; no atribuir toda diferencia al código |
| D007 - 2026-11-04 | Aprobada | Separar carga HTTP, experiencia del navegador y métricas de infraestructura | GA4 no reemplaza k6 ni mediciones de recursos |
| D008 - 2026-11-04 | Aprobada | Línea base con consultas reales; optimizar después de medir | Caché e índices se estudian con configuración documentada |
| D009 - 2026-11-04 | Aprobada | Mantener interfaz moderna con funciones acotadas | Diseño adaptable y claro; sin paneles ni flujos comerciales innecesarios |
| D010 - 2026-11-04 | Aprobada | Etapa 0 exclusivamente documental y autorización por etapa | Etapa 1, commit y despliegue pendientes de autorización |

No hay resultados de desempeño medidos ni proveedor cloud seleccionado.
