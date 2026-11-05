-- No renombrar ni fusionar cuentas existentes de manera silenciosa.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE "email" <> lower(trim("email"))) THEN
    RAISE EXCEPTION 'Existen correos sin normalizar; revisar antes de migrar.';
  END IF;
END $$;
ALTER TABLE "User" ADD COLUMN "passwordHash" VARCHAR(300);
ALTER TABLE "Cart" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_max" CHECK ("quantity" <= 99);
