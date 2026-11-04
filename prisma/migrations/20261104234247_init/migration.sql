-- Restricciones de integridad que Prisma no expresa en schema.prisma.
ALTER TABLE "Product" ADD CONSTRAINT "Product_priceClp_nonnegative" CHECK ("priceClp" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_totalClp_nonnegative" CHECK ("totalClp" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_unitPriceClp_nonnegative" CHECK ("unitPriceClp" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_amountClp_nonnegative" CHECK ("amountClp" >= 0);
