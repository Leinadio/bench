-- AddUniqueConstraint
ALTER TABLE "RiskFactor" ADD CONSTRAINT "RiskFactor_filingId_orderIndex_key" UNIQUE ("filingId", "orderIndex");
