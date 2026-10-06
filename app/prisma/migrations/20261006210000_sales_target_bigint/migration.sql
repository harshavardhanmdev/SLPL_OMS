-- The company year target is Rs 5 crore, 5,000,000,000 paise, past what an
-- integer column holds. Widening is lossless.
ALTER TABLE "SalesTarget" ALTER COLUMN "revenueTarget" SET DATA TYPE BIGINT;
