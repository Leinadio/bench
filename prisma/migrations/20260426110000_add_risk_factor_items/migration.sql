-- Remove description and riskManagement from RiskFactor (moved to RiskFactorItem)
-- First clear existing data since schema is incompatible
DELETE FROM "RiskFactor";
DELETE FROM "RiskCategory";

ALTER TABLE "RiskFactor" DROP COLUMN IF EXISTS "description";
ALTER TABLE "RiskFactor" DROP COLUMN IF EXISTS "riskManagement";

-- Create RiskFactorItem table
CREATE TABLE "RiskFactorItem" (
    "id" TEXT NOT NULL,
    "factorId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskManagement" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RiskFactorItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskFactorItem_factorId_idx" ON "RiskFactorItem"("factorId");
CREATE UNIQUE INDEX "RiskFactorItem_factorId_orderIndex_key" ON "RiskFactorItem"("factorId", "orderIndex");

ALTER TABLE "RiskFactorItem" ADD CONSTRAINT "RiskFactorItem_factorId_fkey"
    FOREIGN KEY ("factorId") REFERENCES "RiskFactor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
