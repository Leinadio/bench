-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "index" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "parsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Filing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL DEFAULT 'other',
    "content" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialData" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),

    CONSTRAINT "FinancialData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_ticker_key" ON "Company"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "Filing_companyId_year_key" ON "Filing"("companyId", "year");

-- CreateIndex
CREATE INDEX "Section_filingId_idx" ON "Section"("filingId");

-- CreateIndex
CREATE INDEX "Section_category_idx" ON "Section"("category");

-- CreateIndex
CREATE INDEX "FinancialData_filingId_idx" ON "FinancialData"("filingId");

-- CreateIndex
CREATE INDEX "FinancialData_tagName_idx" ON "FinancialData"("tagName");

-- AddForeignKey
ALTER TABLE "Filing" ADD CONSTRAINT "Filing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Filing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialData" ADD CONSTRAINT "FinancialData_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Filing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
