# Recursos visuales

Revisión: 2026-11-04. Todos los recursos que carga la tienda son archivos locales. No hay peticiones de imágenes a terceros durante la navegación.

## Hero

- Archivo: `public/images/hero/road.webp`.
- Fotografía: **Annie Spratt**, «black car on road», publicada el 9 de febrero de 2018.
- Página de origen y autor: https://unsplash.com/photos/black-car-on-road-sCZ4YWtnzZA
- Licencia verificada en la propia página: [Unsplash License](https://unsplash.com/license). Autoriza uso y modificación dentro de una obra, con las restricciones indicadas por Unsplash; no se ofrece la imagen original para venta ni como banco de imágenes.
- URL de recurso original: `https://images.unsplash.com/photo-1518209219500-65a795f1bd73`.
- Transformaciones: recorte 1600x900, conversión WebP y recompresión local con sharp (calidad final 36). Peso final 191.920 bytes; sin metadatos originales. La fotografía contiene un vehículo a distancia, sin asociación comercial con su fabricante.
- Se usa `next/image` con dimensiones 1600x900, `sizes="100vw"` y `preload`. Es el único recurso visual precargado por la aplicación.

## Productos y categorías

- `public/images/products/product-01.webp` a `product-30.webp`: ilustraciones vectoriales originales creadas como parte de este proyecto, no fotografías de productos comerciales. Corresponden en orden a los 30 productos de `prisma/seed-data.ts`.
- Fuentes editables: `public/images/sources/product-01.svg` a `product-30.svg`. Generador reproducible: `scripts/create-product-images.mjs`. No contienen logos ni imágenes de terceros. Son recursos propios del proyecto para su uso y modificación; no dependen de una licencia externa desconocida.
- Cada producto incluye alt que identifica su carácter referencial. El detalle indica que la ilustración no representa una marca o certificación.
- WebP 800x800, calidad 82; máximo observado 7.934 bytes. Incluye `fallback.webp` original para errores de carga.
- `next/image` recibe ancho/alto explícitos, `sizes` adaptativo y carga diferida por defecto; el espacio se reserva mediante proporción estable.
- Los 1.000/10.000 productos sintéticos reutilizan los mismos 30 recursos; no se generan imágenes por variante.
- Iconos de categorías, buscador y logotipo: SVG/CSS originales incorporados al código; sin bibliotecas ni fuentes remotas.

El script de ilustraciones utiliza sharp ya instalado transitivamente por Next.js, solo como utilidad opcional de autoría. No forma parte de build ni seed. Para regeneración futura, comprobar disponibilidad con `npm ls sharp`; no se añadió dependencia de producción.

## Caché y pruebas

Los datos de catálogo no se cachean. Las imágenes sí usan el optimizador y caché de Next.js/navegador; documentar caché fría/caliente al medir experiencia. La caché de imágenes no debe confundirse con la línea base de PostgreSQL. Las capturas de QA están en `test-results/`, ignoradas por Git y regenerables con `npm run test:browser`.
