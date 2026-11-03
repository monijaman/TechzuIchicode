-- Preserve existing company-owned menu rows while allowing the shared HQ catalog
-- used by the current HTTP contract. The partial index keeps global names unique.
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_companyId_fkey";
ALTER TABLE "MenuItem" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "MenuItem_global_name_key" ON "MenuItem"("name") WHERE "companyId" IS NULL;
