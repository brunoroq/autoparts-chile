# Revisión de integración y entrega — 2026-11-16

Rama: `feature/k6-purchase-safe`. HEAD: `40829fafa99fefa35142fd368696191e7b4d3eea`. Cambios todavía sin commit. Ninguna ejecución nueva de k6, cambios de servicios/bases, merge, commit o push en esta revisión.

## Veredicto

Código preparado para commit selectivo, sujeto a autorización. NO autorizar un `git add .` ni integrar a ciegas la rama de Matías. La publicación requiere verificar de nuevo el remoto, resolver el acceso a evidencias y decidir qué hacer con los despliegues Preview. No se hizo fetch: el estado remoto real puede haber cambiado.

## Lista exacta propuesta para el commit

Rutas relativas a este worktree; incluir todos estos archivos y ninguno mediante comodines generales:

```text
AGENTS.md
LogFile.txt
package.json
Dockerfile.purchase
compose.purchase-performance.yaml
src/app/api/performance/status/route.ts
src/lib/observability/purchase-isolation.ts
performance/k6/purchase-flow.js
performance/k6/purchase-flow.d.ts
performance/k6/purchase-journey.js
performance/k6/purchase-policy.js
performance/k6/purchase-policy.d.ts
scripts/analyze-purchase.ts
scripts/prepare-purchase-lab.ts
scripts/purchase-accounts.ts
scripts/purchase-analysis.ts
scripts/purchase-auth.ts
scripts/purchase-environment.ts
scripts/purchase-preflight.ts
scripts/run-purchase-once.ts
scripts/run-purchase-performance.ts
tests/purchase-analysis.test.ts
tests/purchase-performance.test.ts
docs/auditoria-compra-k6-2026-11-16.md
docs/performance/purchase-safe.md
docs/performance/purchase-lab-preflight-2026-11-16.json
docs/performance/purchase-concurrent-plan.md
docs/performance/purchase-concurrent-preflight-20261116.md
docs/performance/purchase-concurrent-results-20261116.md
docs/performance/purchase-integration-review-20261116.md
```

El JSON de preflight documenta la preparación inicial (cero pedidos entonces), no la situación actual. La nota del preflight fallido documenta un intento sin carga. Mantener ambas por trazabilidad, con los resultados posteriores como estado vigente. No incluir package-lock: no se añadieron dependencias. Las entradas de LogFile de esta rama comienzan en 112; no copiar encima el registro más avanzado del otro worktree. La entrada 117 conserva caracteres dañados por codificación; documentar cualquier corrección como nueva entrada, sin reescribir el histórico.

## Exclusiones

- `.config/k6/installation-id`: identificador de instalación local, sin utilidad para reproducir. La autorización posterior de commit local permitió agregar su regla puntual a `.gitignore`; el identificador permanece privado y fuera del índice. El conjunto autorizado pasa a ser los 30 archivos enumerados más `.gitignore`.
- `artifacts/purchase-lab/**/compose.env`, todos los `.env` privados, secretos de autenticación/DB/pago, cookies, sesiones y credenciales. Ya quedan fuera por las reglas de `.gitignore`.
- `node_modules` (junction local), `.next`, `src/generated`, tsbuildinfo, dumps, datos PostgreSQL, logs y trazas privadas.
- Snapshots `before.json`/`after.json` y verificaciones SQL sin sanear: contienen identificadores de usuarios, pedidos, carritos y claves de idempotencia. Mantener privados; no anexarlos completos por comodidad.
- No levantar la exclusión general `/artifacts/` ni usar `git add -f artifacts`.

## Evidencias verificadas y propuesta de anexo

| Ejecución | Compras | HTTP k6 | Errores | Fuentes originales |
|---|---:|---:|---:|---|
| 206d0db0-457c-48a6-a93b-dc93e0a95b71 | 1 | 17 | 0 | artifacts/purchase-results/206d0db0-457c-48a6-a93b-dc93e0a95b71/ |
| 635f372f-a8bb-45f8-b97e-4584aec6dd02 | 10 | 140 | 0 | artifacts/purchase-results/635f372f-a8bb-45f8-b97e-4584aec6dd02/ |

Se comprobaron los siete hashes del manifiesto funcional y los diez del manifiesto concurrente: todos coinciden. Originales JSON/CSV/JSONL disponibles; suman 1.133.695 bytes entre los once archivos de ambas carpetas. No hay un problema de tamaño para estos dos ensayos. El CSV de estrés de Matías (~98,5 MB) pertenece a otra serie y no debe agregarse aquí.

Propuesta, todavía sin copiar ni publicar: crear `docs/evidence/purchase/{1vu,10vu}/` con summary.json, plan.json, outcome.json y análisis de rutas saneado; un manifiesto SHA-256 de originales y un README que enlace los reportes, explique unidades, preparación de sesión y ubicación del archivo externo. Los CSV/JSONL de estas compras son pequeños y podrían incluirse tras revisión final, o ir en un ZIP externo con acceso de lectura y hashes. Nunca copiar la carpeta del laboratorio ni los snapshots SQL privados. El manifiesto debe distinguir hash del original y de cualquier derivado saneado, y no aparentar que un archivo transformado es idéntico al original.

Los IDs de experimento y UUID del entorno local son referencias de evidencia, no credenciales; los IDs GA4 son públicos y en tests sirven para demostrar rechazo. No se detectaron cookies/JWT/correos sintéticos/tokens en las fuentes métricas de ambos ensayos mediante el barrido realizado. Esto no reemplaza la revisión final del paquete que se publique. Las rutas locales de los reportes NO son enlaces descargables para el profesor.

## Seguridad y procedencia

`8ebe47a` no es antecesor de HEAD; no se importó ni cherry-pickeó. Se identificó en memoria el secreto incrustado para buscar coincidencias: ninguna en los 345 archivos candidatos examinados. Tres secretos privados actuales del laboratorio se compararon en memoria: ninguna coincidencia en candidatos. No se imprimieron valores. Las coincidencias de URLs Neon en .env.example y tests son placeholders/fixtures, no conexiones operativas.

La rama remota insegura y su historial siguen existiendo: este trabajo no demuestra que el secreto publicado se haya revocado. Confirmar revocación manual antes de compartir nuevas referencias a ese material; no reescribir historial sin acuerdo. La atribución conceptual a Matías queda en purchase-safe.md, sin inventar autoría Git.

## Compatibilidad e integración

La referencia local `origin/main` está en `decfa361b5f550dadc93f1aff253b3344fd74dd6`, que es antecesor de HEAD. Por esa referencia, no hay commits exclusivos de main que resolver y el historial ya incluye la corrección Webpay 40829fa. Esto no confirma la situación actual en GitHub: no se contactó el remoto.

La integración completa también arrastraría commits seguros previos (observadores y evidencias), no solo estos archivos nuevos. Contra main aparecen cambios heredados en numerosos archivos; distinguirlos del commit selectivo de compras. Existe riesgo de conflictos futuros en package.json, LogFile.txt, AGENTS.md, status y scripts compartidos si otras ramas avanzan. El otro worktree tiene auditorías y anexos pendientes que no están en esta rama: no reemplazarlos con versiones anteriores.

Plan posterior: autorizar commit de la lista exacta, revisar índice y secretos, confirmar 40829fa como ancestro, actualizar referencias remotas y comparar bases, publicar solo la rama autorizada y abrir revisión. Integrar en un worktree limpio con conflictos resueltos explícitamente, volver a validar y aprobar cualquier despliegue por separado. No mezclar origin/feature/k6-load-testing. La configuración actual de Vercel solo excluye feature/performance-evidence: publicar esta nueva rama puede activar Preview y fallar por falta de DATABASE_URL. Decidir previamente la política, sin copiar secretos de producción.

Dockerfile.purchase reutiliza autoparts-performance:local; un equipo nuevo debe construir primero esa imagen según Dockerfile.performance. Windows requiere Docker Linux, k6 y los recursos documentados. No es una imagen autónoma descargable. El marcador de compras está desactivado salvo opt-in de entorno; no cambia contratos ni migraciones de negocio.

## Validaciones de esta revisión

- npm test: 55/55 aprobadas, exclusivamente offline/dobles; no k6 real.
- npm run lint: aprobado, cero warnings.
- npm run typecheck: aprobado; generación Prisma y Next local con URL ficticia loopback:1, telemetría desactivada. No consulta DB.
- git diff --check: aprobado; advertencias LF/CRLF habituales, sin errores.
- No build nuevo solicitado ni ejecutado en esta revisión. No servicios ni infraestructura operados.

## Pendientes para la pauta y la entrega

La compra k6 queda funcionalmente acreditada con 1 y 10 VUs. No se necesitan más ejecuciones para esa evidencia. No afirmar capacidad sostenida, idempotencia de callbacks duplicados o agotamiento de última unidad basándose en estos ensayos.

Pendientes documentales según auditoría existente del otro worktree: actualizar el informe final con esta compra y el arreglo local del callback (sin afirmar redeploy/otra prueba Webpay), publicar anexos accesibles con hashes, comprobar acceso al repositorio/enlaces, adjuntar captura de Lector del profesor y propiedad/período GA4, explicar población/embudo y ausencia de comparación GA4 normal-carga si no está acreditada, comprobar formato del registro de prompts/formulario, finalizar video con todos los integrantes visibles y presentación. Las seis CWV ya están verificadas: no pedir nuevas mediciones. La confirmación del acceso GA4 del profesor no requiere modificar permisos. El borrador y anexos externos no se modificaron aquí.
