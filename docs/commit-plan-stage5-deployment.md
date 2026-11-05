# Cierre en dos commits separados

Autorizados por prompt 016. Base anterior: b4fd0006c5db5ac66d220955b64f08a746b6f60d. No se altera la base local ni se publica el proyecto.

## 1. feat: integrar GA4 con consentimiento, Web Vitals y observabilidad

Commit 69fe039280522b79f0b147432cee0afc2778ee6a: 44 archivos. Incluye eventos/consentimiento, reclamación de compra y su migración, Web Vitals, instrumentación y exportaciones, pruebas y documentación de etapa 5 hasta prompt 013. Los archivos y blobs del índice coincidieron exactamente con la instantánea previa a preparación cloud. No contiene guardas/configuración/scripts exclusivos del despliegue.

## 2. chore: preparar Vercel y Neon con bootstrap seguro

Commit de cierre de preparación: consultar git log para el hash. Incluye únicamente el delta de Node24, pool/configuración Neon, guardas serverless/pagos, runtime Node, conexión administrativa, scripts cloud y bootstrap de solo inserción, pruebas/aislamiento y documentos/registros 014–016. Los archivos compartidos se separaron por contenido; no se arrastró otra implementación de etapa 5.

## Auditoría y conservación

La instantánea ignorada tmp/pre-deployment-stage5 conservó los 44 archivos y sus SHA-256 antes de preparar despliegue. Se construyó el primer índice desde esos blobs sin restaurar ni descartar el working tree; el segundo contiene solo el delta posterior. No se usó reset --hard ni se reescribió historial. Las instantáneas y artefactos no se versionan.

Cada índice se audita por separado: exclusión de .env privados, credenciales conocidas, claves privadas, datos PostgreSQL, node_modules y generados, además de enlaces internos. Lint/TypeScript/Prisma, 23 unitarias y build se repitieron con éxito en el cierre; se conserva el informe previo de regresión de 63 casos sin modificar código ni repetir escrituras de datos.

AGENTS.md y LogFile.txt conservan autorización, límites y resultados. El segundo hash y estado limpio se entregan en chat para no modificar archivos después de confirmar. Sin push, Neon, despliegue, carga o etapas nuevas. Después de los dos commits, detenerse; la creación manual de Neon requiere una nueva instrucción.
