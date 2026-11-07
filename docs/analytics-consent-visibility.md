# Visibilidad y accesibilidad del consentimiento

Fecha: 2026-11-06, America/Santiago. Cambios exclusivamente locales de presentación; sin publicar ni cambiar configuración o lógica de Analytics.

## Diagnóstico observado

Se abrió el dominio estable en contextos nuevos, sin consentimiento, bloqueando todas las escrituras y cualquier origen externo. No se aceptó Analytics ni se enviaron eventos reales. El aviso existía, con position:fixed, z-index:50, display:block, opacity:1 y sin un elemento superpuesto en su centro:

| Pantalla | Rectángulo del aviso anterior |
| --- | --- |
| 1440 × 1000 | izquierda 16, arriba 824, ancho 620, alto 160 |
| 390 × 844 | izquierda 16, arriba 644, ancho 358, alto 184 |

En ambas pantallas quedaba íntegramente dentro del viewport; cero intentos de Google y cero scripts gtag. No se reprodujo una ausencia por renderizado, posición o z-index. La captura muestra un panel pequeño en la esquina inferior izquierda, poco destacado frente al hero y sin título. No se inspeccionó el navegador personal del usuario: no se puede afirmar cuál era su decisión almacenada.

El código oculta correctamente el aviso si localStorage conserva granted o denied; antes, el botón de preferencias quedaba en el flujo al final de la página. Esto puede explicar que un visitante que ya decidió no encuentre cómo cambiarlo, pero no acredita por sí solo la causa de su caso concreto. No se reinicia ni elimina el consentimiento guardado automáticamente.

## Cambios locales

- Panel centrado y fijo al pie, ancho máximo 900 px, título «Tu privacidad, tu decisión», borde rojo y mayor contraste/sombra. z-index:1000, por encima de los elementos existentes revisados.
- Botones con el mismo color, tamaño y peso visual: aceptar y rechazar sin opción preseleccionada. Dos columnas en escritorio y una en móviles angostos, controles de 48 px y foco visible.
- Región accesible identificada como Preferencias de analítica y descripción asociada. No es modal, no bloquea el foco ni cambia automáticamente la decisión.
- Altura limitada al viewport con desplazamiento interno para pantallas cortas y margen inferior que contempla safe-area. Sin animaciones nuevas.
- Botón Preferencias de analítica fijo y visible después de decidir, con área táctil mínima de 44 px. Conserva exactamente su comportamiento anterior: revoca, intenta eliminar cookies de GA y recarga para mostrar otra vez el aviso.

No se alteraron choose/revoke/initialize, lectura de consentimiento, guardas config.enabled/choice, eventos, deduplicación purchase, rutas o persistencia. Cambios del componente limitados a markup, clases y type de los botones. Sin dependencias nuevas.

## Verificaciones

```powershell
npm run test:analytics:browser:local
npm test
npm run validate
npm run build
```

Ocho pruebas de navegador correctas: las cuatro regresiones anteriores y cuatro escenarios nuevos con viewports 1440×1000, 390×844, 320×568 y 844×390. El harness monta componentes React reales y sirve el CSS global real (sin el import de Tailwind, conservando las reglas propias), con Next/Google/HTTP simulados y sin base de datos. Verifica encuadre, ausencia de desbordamiento horizontal, botones sin obstrucción, igualdad de fondo, área táctil, foco/Tab/Enter/Espacio, rechazo persistente tras recargar, aceptación y revocación sin script/eventos posteriores.

29 unitarias, lint, TypeScript, Prisma y build correctos. Ninguna prueba creó usuarios, pedidos o pagos reales. Capturas del harness en tmp/consent-preview, ignoradas por Git; escritorio y móvil inspeccionados visualmente. Las capturas iniciales de producción quedan privadas fuera del repositorio; no contienen datos personales.

Pendiente tras una futura autorización: revisión sobre la tienda completa con estos estilos publicados y dispositivos reales, especialmente Safari/iOS y sus safe areas. Las pruebas locales usan el harness, no un despliegue ni un envío a GA4. Sin modificaciones Neon, checkout, pagos, inventario, variables Vercel, commits, push o despliegues. Cambios E2E/documentales anteriores pendientes conservados.

Verificación exclusiva antes de publicación: 27 unitarias del snapshot, ocho escenarios de navegador, lint, TypeScript, Prisma y build correctos; las dos unitarias adicionales del verificador anterior quedan fuera de este commit. No se cambió la lógica de Analytics.
