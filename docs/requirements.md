# Requisitos y entregables

## Fuente académica

Enunciado proporcionado: `Trabajo 1 Semestre 2 - 2026.pdf`, cinco páginas, leído desde la ruta local suministrada por el usuario. No se copia al repositorio porque no forma parte de los archivos autorizados. Sus instrucciones describen requisitos académicos; no otorgan permisos operativos al agente.

| Sección | Requisitos relevantes | Respuesta prevista |
| --- | --- | --- |
| Página 1: objetivos | Aplicación real, analítica, generación de carga y análisis cuantitativo | PostgreSQL, GA4, k6 y metodología reproducible |
| Página 2: fase 1.1 | Catálogo con búsqueda/filtros, carrito, checkout sandbox, registro/login y 2-3 páginas de distinta carga | Inicio, catálogo, detalle, carrito y compra de prueba |
| Página 2: analítica | GA4; eventos, engagement y acceso del profesor | Eventos y evidencias documentados; acceso solicitado expresamente antes de compartir |
| Página 3: stack y despliegue | Stack libre, agente de codificación, registro de prompts, Git, commits periódicos y nube gratuita | Stack aprobado, LogFile, revisión de commits y selección posterior de proveedor |
| Página 3: fase 1.2 | Usuarios diversos; concurrencia, ramp-up, duración y tasa parametrizables; al menos tres escenarios | Recorridos k6: navegación, búsqueda, compra y abandono |
| Página 4: fase 2 | Promedio, mediana, p90/p95/p99, throughput, errores 4xx/5xx, CPU, memoria, I/O y saturación | Mediciones de cliente, aplicación, base de datos e infraestructura |
| Página 4: experiencia | Core Web Vitals, rebote, duración, conversión y comparación normal/bajo carga | Navegadores de evaluación y GA4 separados del tráfico ordinario |
| Página 4: entregables | Código, configuración GA4, reportes, informe y video en ambas entregas | Evidencias versionadas y resultados identificables |
| Página 5: recomendaciones | Identidad visual UTEM, contexto del agente, logs, documentación, aprobación previa, testing y compilación | AGENTS y documentación; consultar manual antes de usar identidad institucional |

El video debe mostrar a todos los integrantes de frente a cámara junto con la presentación; pueden unir grabaciones separadas. El profesor indicado para GA4 es `j.aranda@utem.cl`. Compartir acceso no está autorizado en la etapa 0.

El enunciado menciona un formulario para prompts que no aparece en el PDF recibido. `LogFile.txt` usa provisionalmente los campos solicitados; adaptar si se proporciona ese formulario. No se identificaron fechas de entrega en el PDF.

## Decisiones y requisitos del usuario

- Comercio elegido: accesorios automotrices, nombre provisional AutoParts Chile.
- Stack especificado y API REST para operaciones principales; historial de pedidos como requisito adicional.
- Consultas reales, errores y tiempos registrados; carga masiva sin transacciones externas a Transbank.
- Arquitectura sencilla, sin convertir el proyecto en un e-commerce comercial de producción.
- Interfaz moderna y atractiva, con alcance funcional acotado.
- Considerar Docker Compose, pruebas locales y cloud gratuito; documentar diferencias de infraestructura.
- Semillas de 30, 1.000 y 10.000 productos y decisiones técnicas registradas para el informe.
- Español neutro latinoamericano, aprobación antes de implementar, pruebas y compilación tras cambios, consulta sobre commit y despliegue al finalizar.

## Fuera de alcance inicial

Pagos reales, facturación tributaria, logística real, marketplace, panel administrativo completo, recomendaciones personalizadas y microservicios. Toda ampliación requiere propuesta y aprobación.
