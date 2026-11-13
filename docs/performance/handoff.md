# Continuación del trabajo de desempeño

## Estado compartido

Se completaron las cargas HTTP locales baja, normal y pico, sin compras ni cambios
de inventario. Los resultados medidos y sus limitaciones están en
[baja](first-low-30-results.md), [normal](normal-30-results.md) y [pico](pico-30-results.md).
Los JSON/CSV crudos permanecen locales en `artifacts/`, ignorados por Git. Los
resúmenes no equivalen a publicar los archivos crudos para una auditoría independiente.

GA4 oficial recibe visitas humanas consentidas. k6 HTTP no ejecuta JavaScript ni
envía eventos GA4. Los intentos k6/browser con la propiedad de laboratorio no
confirmaron eventos. No atribuirles visitas visibles en GA4 sin evidencia.
La investigación de Chromium, proxy y observadores está pausada; se conserva el
código y diagnóstico para revisión, sin considerarlo una integración validada.

La serie CWV activa usa el [protocolo manual simplificado](core-web-vitals-manual.md).
El [protocolo original](core-web-vitals-protocol.md) y el CLI `cwv` se conservan
como preparación histórica de 30 visitas, con reglas diferentes. No aplicar su
analizador estricto a la nueva serie manual de 18 visitas.

## Obtener y verificar

```powershell
git fetch origin
git switch --track origin/feature/performance-evidence
npm ci
# Configurar una .env privada desde .env.example con valores locales propios.
npm run validate
npm test
npm run test:cwv
```

Estos comandos no ejecutan carga. `test:performance` incluye un caso de Chrome
con transporte simulado; para una revisión exclusivamente offline usar:

```powershell
node --import tsx --test --test-skip-pattern="recorrido compartido" tests/performance.test.ts tests/performance-browser.test.ts tests/performance-observer.test.ts tests/performance-diagnostics.test.ts tests/performance-observer-marker.test.ts tests/performance-chromium-research.test.ts
```

Requisitos: Node 24, npm 11; para preparar un laboratorio propio, Docker Desktop
Linux y los recursos/precauciones descritos en [Fase 1.2](phase-1-2.md). Los UUID,
contenedores y rutas Windows de las ejecuciones históricas no son portables:
generar un entorno propio con el preparador tras aprobación, nunca copiar
`compose.env`, credenciales ni volúmenes ajenos.

No ejecutar migraciones, seed, cargas ni conexiones contra Neon/Vercel de
producción. GA4 queda apagado por defecto; el ID oficial está bloqueado en los
observadores sintéticos. No activar observadores ni repetir cargas automáticamente.

## Publicación y exclusiones

La rama `feature/performance-evidence` es de revisión. `vercel.json` desactiva
los despliegues Git automáticos solo para ese nombre; no modifica `main` ni las
variables remotas. Regla oficial:
https://vercel.com/docs/project-configuration/git-configuration

No se incluyen `.env` privados, bases/respaldos, `node_modules`, `.next`, cliente
Prisma generado, `tmp`, capturas, trazas o resultados masivos de `artifacts`.
Los ejemplos `.env.example` y `.env.performance.example` sí son documentación
sin credenciales reales. Los IDs de medición públicos y UUID de experimentos no
son secretos. `LogFile.txt` conserva prompts y resultados saneados.
