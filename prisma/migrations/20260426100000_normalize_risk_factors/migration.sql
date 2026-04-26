-- Add localPath to Filing
ALTER TABLE "Filing" ADD COLUMN "localPath" TEXT;

-- Create RiskCategory table
CREATE TABLE "RiskCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskCategory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskCategory_companyId_idx" ON "RiskCategory"("companyId");
CREATE INDEX "RiskCategory_filingId_idx" ON "RiskCategory"("filingId");
CREATE UNIQUE INDEX "RiskCategory_filingId_orderIndex_key" ON "RiskCategory"("filingId", "orderIndex");

ALTER TABLE "RiskCategory" ADD CONSTRAINT "RiskCategory_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskCategory" ADD CONSTRAINT "RiskCategory_filingId_fkey"
    FOREIGN KEY ("filingId") REFERENCES "Filing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old RiskFactor table and recreate with new schema
DROP TABLE IF EXISTS "RiskFactor";

CREATE TABLE "RiskFactor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sectionRef" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskManagement" TEXT NOT NULL,
    "criticalityScore" INTEGER NOT NULL DEFAULT 2,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskFactor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskFactor_companyId_idx" ON "RiskFactor"("companyId");
CREATE INDEX "RiskFactor_filingId_idx" ON "RiskFactor"("filingId");
CREATE INDEX "RiskFactor_categoryId_idx" ON "RiskFactor"("categoryId");
CREATE UNIQUE INDEX "RiskFactor_filingId_orderIndex_key" ON "RiskFactor"("filingId", "orderIndex");

ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_filingId_fkey"
    FOREIGN KEY ("filingId") REFERENCES "Filing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "RiskCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
