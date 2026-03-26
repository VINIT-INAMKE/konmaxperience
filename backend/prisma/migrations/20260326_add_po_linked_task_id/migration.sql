-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN "linked_task_id" TEXT;

-- AddForeignKey
ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_linked_task_id_fkey"
  FOREIGN KEY ("linked_task_id") REFERENCES "Task"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PurchaseOrder_linked_task_id_idx" ON "PurchaseOrder"("linked_task_id");
