-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "lastPerspectiveRefresh" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Perspective" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bias" TEXT NOT NULL,
    "conviction" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "risks" JSONB NOT NULL,
    "catalysts" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Perspective_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Perspective_companyId_key" ON "Perspective"("companyId");

-- AddForeignKey
ALTER TABLE "Perspective" ADD CONSTRAINT "Perspective_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
