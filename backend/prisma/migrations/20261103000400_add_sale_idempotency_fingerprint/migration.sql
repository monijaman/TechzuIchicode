ALTER TABLE "Sale" ADD COLUMN "idempotencyFingerprint" TEXT;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_idempotency_pair_check"
  CHECK (("idempotencyKey" IS NULL) = ("idempotencyFingerprint" IS NULL));
