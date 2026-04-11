/*
  Warnings:

  - A unique constraint covering the columns `[companyId,sourceUrl]` on the table `Signal` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Signal_companyId_sourceUrl_key" ON "Signal"("companyId", "sourceUrl");
