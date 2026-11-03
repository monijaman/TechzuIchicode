CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "Company" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Outlet" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Outlet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MenuItem_basePrice_positive" CHECK ("basePrice" > 0)
);

CREATE TABLE "OutletMenuItem" (
    "outletId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "priceOverride" DECIMAL(12,2),
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutletMenuItem_pkey" PRIMARY KEY ("outletId", "menuItemId"),
    CONSTRAINT "OutletMenuItem_priceOverride_positive" CHECK ("priceOverride" IS NULL OR "priceOverride" > 0)
);

CREATE TABLE "Inventory" (
    "outletId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("outletId", "menuItemId"),
    CONSTRAINT "Inventory_quantity_nonnegative" CHECK ("quantity" >= 0)
);

CREATE TABLE "ReceiptCounter" (
    "outletId" UUID NOT NULL,
    "lastIssued" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("outletId"),
    CONSTRAINT "ReceiptCounter_lastIssued_nonnegative" CHECK ("lastIssued" >= 0)
);

CREATE TABLE "Sale" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outletId" UUID NOT NULL,
    "receiptNumber" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "soldAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Sale_receiptNumber_positive" CHECK ("receiptNumber" > 0),
    CONSTRAINT "Sale_totalAmount_nonnegative" CHECK ("totalAmount" >= 0)
);

CREATE TABLE "SaleItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "saleId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SaleItem_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "SaleItem_unitPrice_positive" CHECK ("unitPrice" > 0),
    CONSTRAINT "SaleItem_lineTotal_nonnegative" CHECK ("lineTotal" >= 0)
);

CREATE UNIQUE INDEX "Outlet_companyId_name_key" ON "Outlet"("companyId", "name");
CREATE INDEX "Outlet_companyId_idx" ON "Outlet"("companyId");
CREATE UNIQUE INDEX "MenuItem_companyId_name_key" ON "MenuItem"("companyId", "name");
CREATE INDEX "MenuItem_companyId_idx" ON "MenuItem"("companyId");
CREATE INDEX "OutletMenuItem_menuItemId_idx" ON "OutletMenuItem"("menuItemId");
CREATE UNIQUE INDEX "Sale_outletId_receiptNumber_key" ON "Sale"("outletId", "receiptNumber");
CREATE UNIQUE INDEX "Sale_outletId_idempotencyKey_key" ON "Sale"("outletId", "idempotencyKey");
CREATE INDEX "Sale_outletId_soldAt_idx" ON "Sale"("outletId", "soldAt");
CREATE UNIQUE INDEX "SaleItem_saleId_menuItemId_key" ON "SaleItem"("saleId", "menuItemId");
CREATE INDEX "SaleItem_menuItemId_idx" ON "SaleItem"("menuItemId");

ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutletMenuItem" ADD CONSTRAINT "OutletMenuItem_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutletMenuItem" ADD CONSTRAINT "OutletMenuItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_outletId_menuItemId_fkey" FOREIGN KEY ("outletId", "menuItemId") REFERENCES "OutletMenuItem"("outletId", "menuItemId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptCounter" ADD CONSTRAINT "ReceiptCounter_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
