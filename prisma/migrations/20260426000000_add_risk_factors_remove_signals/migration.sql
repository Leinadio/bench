-- AlterTable: drop Signal/Perspective-related columns from Company
ALTER TABLE "Company" DROP COLUMN IF EXISTS "lastSignalRefresh";
ALTER TABLE "Company" DROP COLUMN IF EXISTS "lastPerspectiveRefresh";

-- DropTable: Perspective (has FK to Company)
DROP TABLE IF EXISTS "Perspective";

-- DropTable: Signal (has FK to Company)
DROP TABLE IF EXISTS "Signal";

-- CreateTable: RiskFactor
CREATE TABLE "RiskFactor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impactLevel" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskFactor_companyId_idx" ON "RiskFactor"("companyId");

-- CreateIndex
CREATE INDEX "RiskFactor_filingId_idx" ON "RiskFactor"("filingId");

-- AddForeignKey
ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Filing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
