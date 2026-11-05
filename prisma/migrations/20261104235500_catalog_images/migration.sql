ALTER TABLE "Product"
ADD COLUMN "imagePath" VARCHAR(240) NOT NULL DEFAULT '/images/products/fallback.webp',
ADD COLUMN "imageAlt" VARCHAR(240) NOT NULL DEFAULT 'Ilustración de accesorio automotriz';
