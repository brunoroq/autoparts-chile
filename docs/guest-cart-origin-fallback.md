# Carrito invitado y respaldo seguro de Origin

Fecha: 2026-11-10, America/Santiago. Implementación exclusivamente local en autoparts-review-86673f0, sobre 2220b59. Cierre autorizado mediante un commit local, sin push o despliegue y sin tocar la carpeta principal.

## Política CSRF

checkOrigin conserva el origen canónico configurado por el servidor; no lo deriva de Host o de X-Forwarded-Host. GET/HEAD/OPTIONS mantienen su tratamiento de lectura. Para los demás métodos:

| Origin | Evidencia adicional | Resultado |
| --- | --- | --- |
| Origen canónico exacto | Sin cross-site ni hosts inconsistentes | Aceptar como antes |
| Ausente | Host presente/canónico, Sec-Fetch-Site:same-origin y Referer ausente o canónico | Aceptar |
| Ausente | Host presente/canónico, Fetch Metadata ausente y Referer canónico válido | Aceptar |
| Ausente | Solo Host/X-Forwarded-Host, o sin evidencia suficiente | Rechazar |
| Literal null, vacío o un tercero | Incluso con otros encabezados aparentemente válidos | Rechazar |
| Cualquier caso | Sec-Fetch-Site:cross-site o hosts inconsistentes | Rechazar |

Con Origin ausente también se rechazan same-site, none y valores Fetch Metadata desconocidos. Un Referer presente que contradice el origen o contiene credenciales no se usa como respaldo, aun cuando Fetch Metadata indique same-origin. Se comparan protocolo, hostname y puerto mediante URL.origin, sin coincidencias por prefijo. X-Forwarded-Host solo se verifica como consistencia si existe; nunca acredita legitimidad. Su discrepancia se rechaza también fuera de Vercel.

Esta política complementa CSRF de navegador: no sustituye sesiones, autenticación, permisos ni validación de cantidades/precios/stock. Un cliente HTTP externo puede fabricar encabezados; estos no son credenciales. Los endpoints conservan sus validaciones y el código no registra encabezados, Referer o valores sensibles.

## Carrito y navegación

El controlador ya evita cotizar listas vacías desde 86673f0 y conserva CartView desde 2220b59. No se modifica: siguen visibles «Tu carrito está vacío.» y «Explorar accesorios».

quoteGuest ahora devuelve un snapshot cero local para una lista vacía. Esto también evita la petición al eliminar la última línea mediante changeGuest. Con productos sigue consultando la API real y tomando sus precios/disponibilidad; no se confían precios de localStorage. mergeGuestCart no tiene cambios, incluidos sus comprobantes/idempotencia y tratamiento de errores.

CartView muestra «Iniciar sesión para pagar» al invitado y conserva /iniciar-sesion?callbackUrl=%2Fcheckout. El autenticado mantiene «Continuar al checkout» y /checkout. La protección del checkout en servidor y el flujo de autenticación/fusión existentes no se modifican.

## Pruebas y límites

Comandos ejecutados con entorno ficticio local en memoria:

```powershell
npm run validate
npm test
npm run test:cart:browser:local
npm run test:analytics:browser:local
npm run build
```

Resultados: lint, TypeScript, Prisma y build correctos; 30 unitarias, siete pruebas de navegador del carrito y ocho de regresión Analytics correctas. Los cuatro tests de Origin incluyen positivos same-origin/Referer y negativos de origen opaco, cross-site, same-site/none, hosts, puertos, prefijos, credenciales y ausencia de señales.

El harness de carrito usa CartController, CartView, AddToCart, AuthForm y mergeGuestCart reales, con Next/Auth.js y respuestas HTTP simulados. El servidor ficticio omite Origin y llama al checkOrigin real con los metadatos del navegador. Se verifica agregar/cotizar, modificar, borrar la última línea sin enviar [], persistencia vacía al recargar, interfaz accesible y enlaces de checkout. Un login simulado fusiona dos unidades invitadas con una de cuenta y conserva tres, borra el pendiente local y no vuelve a fusionar tras recargar.

No se crearon cuentas ni pedidos; no se ejercitó el proveedor real de autenticación ni PostgreSQL en esa prueba. La idempotencia durable de fusión no se revalida contra una base en esta tarea: implementación de servidor intacta y receipts solo simulados para este recorrido. El spec integrado guest-cart.spec.ts actualiza únicamente el nombre del enlace; no se ejecuta porque crea usuarios y modifica una base de pruebas.

Pendiente con autorización posterior: verificar los encabezados reales del navegador/proxy que originaron el 403, recepción de Origin ausente bajo Vercel y fusión integrada con sesión/PostgreSQL. Si el navegador envía el literal Origin:null o suprime tanto Origin como las señales de respaldo, seguirá obteniendo 403 intencionalmente. No ampliar la lista de confianza ni desactivar CSRF para evitarlo.

Sin cambios Neon, variables Vercel, Analytics, pagos, inventario, esquema, dependencias, checkout o autenticación. Sin compras ni pruebas de carga. Código y comentarios documentan las decisiones; prompts completos y resultados en LogFile.txt.

Antes del commit local se repitieron validate, las 30 unitarias, siete pruebas del carrito, ocho regresiones de navegador y build, todos correctos. origin/main se comprobó mediante lectura remota y coincide con la base 2220b59. Se preservan la identidad Git legítima configurada y todos los commits anteriores. La comprobación controlada del navegador/proxy en producción no forma parte de este cierre.
