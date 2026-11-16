# Preparación de integración local — 2026-11-16

Worktree `autoparts-integration-k6`, rama `integration/k6-purchase-safe`, creado desde origin/main `decfa361b5f550dadc93f1aff253b3344fd74dd6`. Fast-forward local autorizado hasta `b7de74a40e2b9a392dd45a4b2f41f643a24846fb`; no se creó commit de merge. Contiene exactamente cuatro commits adicionales:

- fb09778: observadores k6/browser y GA4 aislado.
- ec04400: evidencias y protocolos.
- 40829fa: corrección de instrumentación HTTP.
- b7de74a: compras simuladas aisladas y evidencias verificadas.

8ebe47a no es antecesor. main local permanece en f4a6c9c; main remoto referenciado permanece en decfa361. No nuevos fetch, push, actualizaciones de main o despliegues en esta preparación. El worktree de compras permanece limpio. No se tocaron auditorías ni anexos del otro worktree.

## Vercel: alcance real del bloqueo

Se prepararon tres entradas exactas con valor booleano false en git.deploymentEnabled: feature/performance-evidence, feature/k6-purchase-safe e integration/k6-purchase-safe. JSON válido; no comodines superpuestos ni reglas true que anulen la exclusión. Según [documentación oficial](https://vercel.com/docs/project-configuration/git-configuration), las ramas no especificadas se habilitan por defecto y estas reglas desactivan despliegues automáticos de Git para las ramas nombradas.

**Un archivo local sin commit/push no cambia Vercel.** Para el primer push, el tip publicado debe contener este vercel.json y el proyecto debe leer ese archivo desde su raíz configurada. Bajo esas condiciones, la regla está diseñada para impedir el despliegue automático incluso al publicar por primera vez la rama. No se verificó la configuración remota, raíz del proyecto, otros proyectos vinculados, Deploy Hooks ni workflows GitHub que invoquen CLI/API. No hay una garantía incondicional ni una prueba real sin realizar el push; no afirmar que se ha verificado un bloqueo remoto.

La rama feature/k6-purchase-safe todavía apunta a b7de74a y NO contiene este nuevo ajuste. Publicarla así no queda protegida por el cambio que solo existe en integración. El siguiente paso recomendado es autorizar un commit local de esta preparación y posteriormente publicar únicamente integration/k6-purchase-safe tras confirmar configuración y autorización. La regla no bloquea CLI/API/manual, despliegues ya creados ni cambios de main; main sigue habilitada y su integración podría desplegar producción. No usar fallos de build ni falta de secretos como mecanismo de bloqueo.

No se modificó configuración remota de Vercel. Si se exige certeza operativa antes de cualquier push, el propietario debe revisar los proyectos vinculados y aprobar controles remotos adicionales; no desconectar ni cambiar ajustes por iniciativa propia.

## Anexo público preparado

[README y descargas](../evidence/purchase/README.md). Doce archivos métricos copiados byte por byte, 1.134.272 bytes, con manifiesto exclusivo de esos archivos. El análisis 1 VU proviene del posprocesado separado posterior, expresamente identificado. No se copiaron snapshots SQL ni manifiestos privados que los referencien. UUIDs presentes limitados a experimentos y entorno local, no a usuarios/pedidos. No contraseñas, sesiones, cookies, cuentas sintéticas o tokens detectados por los barridos realizados. Comparación en memoria con secreto expuesto y tres secretos locales: cero coincidencias.

Doce hashes públicos coincidentes, tamaños verificados y diecisiete hashes históricos intactos. El README declara que sus enlaces solo serán públicos tras publicar este paquete. No se generan métricas nuevas.

## Validaciones

- TypeScript aprobado, con Prisma generate y Next typegen locales, configuración ficticia loopback:1 y telemetría desactivada.
- 55/55 tests offline aprobados; lint aprobado.
- Reglas JSON y tipos de booleanos comprobados; hashes de originales y copias comprobados.
- No build nuevo solicitado/ejecutado, no k6, navegador, compras, servicios, bases o infraestructura.
- node_modules es una junction local ignorada para reutilizar dependencias existentes, sin instalación. No versionarla ni copiar credenciales.

## Lista exacta para próximo commit local (no creado)

```text
vercel.json
LogFile.txt
docs/performance/integration-preparation-20261116.md
docs/evidence/purchase/README.md
docs/evidence/purchase/sha256.json
docs/evidence/purchase/1vu/summary.json
docs/evidence/purchase/1vu/plan.json
docs/evidence/purchase/1vu/outcome.json
docs/evidence/purchase/1vu/k6.csv
docs/evidence/purchase/1vu/k6.jsonl
docs/evidence/purchase/1vu/analysis.json
docs/evidence/purchase/10vu/summary.json
docs/evidence/purchase/10vu/plan.json
docs/evidence/purchase/10vu/outcome.json
docs/evidence/purchase/10vu/k6.csv
docs/evidence/purchase/10vu/k6.jsonl
docs/evidence/purchase/10vu/analysis.json
```

GO para revisión y futuro commit local autorizado. **NO-GO para publicar ahora**: no hay autorización ni commit del bloqueo/anexo; revisar automatizaciones remotas antes del primer push. La revocación del API secret en la rama insegura sigue sin acreditarse y este paquete no sanea ese historial. No integrar esa rama. Los anexos generales GA4/CWV/Webpay y CSV grandes de otras series siguen en su preparación independiente, sin sobrescribirlos.
