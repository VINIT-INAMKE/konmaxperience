-- CreateEnum
CREATE TYPE "BridgeOutcome" AS ENUM ('applied', 'skipped_no_task', 'skipped_no_mission', 'skipped_no_owner', 'failed');

-- AlterTable
ALTER TABLE "ReadinessMeter" ADD COLUMN     "derived_value" DOUBLE PRECISION,
ADD COLUMN     "last_computed_at" TIMESTAMPTZ(3),
ADD COLUMN     "task_value" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BridgeDispatch" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "rule_key" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "task_id" TEXT,
    "evidence_id" TEXT,
    "outcome" "BridgeOutcome" NOT NULL DEFAULT 'applied',
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BridgeDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BridgeDispatch_node_id_created_at_idx" ON "BridgeDispatch"("node_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "BridgeDispatch_event_created_at_idx" ON "BridgeDispatch"("event", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BridgeDispatch_rule_key_source_type_source_id_key" ON "BridgeDispatch"("rule_key", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "Approval_required_role_code_status_idx" ON "Approval"("required_role_code", "status");

-- CreateIndex
CREATE INDEX "Decision_status_created_at_idx" ON "Decision"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Evidence_task_id_source_idx" ON "Evidence"("task_id", "source");

-- AddForeignKey
ALTER TABLE "BridgeDispatch" ADD CONSTRAINT "BridgeDispatch_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
