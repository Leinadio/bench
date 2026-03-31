-- CreateTable
CREATE TABLE "CompanySummary" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "scoreJustification" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "bulletPoints" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanySummary_companyId_idx" ON "CompanySummary"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySummary_filingId_theme_key" ON "CompanySummary"("filingId", "theme");

-- AddForeignKey
ALTER TABLE "CompanySummary" ADD CONSTRAINT "CompanySummary_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Filing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySummary" ADD CONSTRAINT "CompanySummary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
