-- New enum values live in their own migration: Postgres refuses to use a value
-- added in the same transaction, and the next migration defaults to IN_HAND.
ALTER TYPE "QuotationStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "QuotationStatus" ADD VALUE 'APPROVED';
ALTER TYPE "SampleStatus" ADD VALUE 'IN_HAND';
