-- CreateEnum
CREATE TYPE "DailyCloseStatus" AS ENUM ('open', 'signed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'shipment_failed';
ALTER TYPE "NotificationType" ADD VALUE 'morning_brief';
ALTER TYPE "NotificationType" ADD VALUE 'daily_close_due';

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "is_email_sent";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DailyClose" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "business_date" DATE NOT NULL,
    "status" "DailyCloseStatus" NOT NULL DEFAULT 'open',
    "metrics" JSONB NOT NULL,
    "notes" TEXT,
    "signed_by" TEXT,
    "signed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DailyClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceReviewSuggestion" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "evidence_id" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "reasons" TEXT[],
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceReviewSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyClose_node_id_status_business_date_idx" ON "DailyClose"("node_id", "status", "business_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DailyClose_node_id_business_date_key" ON "DailyClose"("node_id", "business_date");

-- CreateIndex
CREATE INDEX "EvidenceReviewSuggestion_evidence_id_created_at_idx" ON "EvidenceReviewSuggestion"("evidence_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "DailyClose" ADD CONSTRAINT "DailyClose_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyClose" ADD CONSTRAINT "DailyClose_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReviewSuggestion" ADD CONSTRAINT "EvidenceReviewSuggestion_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReviewSuggestion" ADD CONSTRAINT "EvidenceReviewSuggestion_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Hand-written integrity CHECKs (P6) ──────────────────────────────────────
-- The generator cannot produce these: Prisma's datamodel has no CHECK concept,
-- so they live here as raw SQL and are invisible to `migrate diff` (the P5a
-- precedent — `Review_rating_range`, `Coupon_window_valid` — behaves the same).

-- A signed daily close is frozen (P6 decision 16). The service enforces this,
-- but a raw SQL fix-up would not, and the metrics are the audit record.
ALTER TABLE "DailyClose"
  ADD CONSTRAINT "DailyClose_signed_has_signer"
  CHECK ("status" <> 'signed' OR ("signed_by" IS NOT NULL AND "signed_at" IS NOT NULL));

-- A suggestion is never a decision: `verdict` is deliberately not an enum
-- (P6 Task 1) so it can never be cast to ApprovalStatus, but it is still closed.
ALTER TABLE "EvidenceReviewSuggestion"
  ADD CONSTRAINT "EvidenceReviewSuggestion_verdict_check"
  CHECK ("verdict" IN ('approve', 'reject', 'unsure'));
