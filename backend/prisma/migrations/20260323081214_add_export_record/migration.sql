-- CreateTable
CREATE TABLE "ExportRecord" (
    "id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters_applied" TEXT,
    "file_size_bytes" INTEGER NOT NULL,
    "r2_key" TEXT NOT NULL,
    "download_url" TEXT NOT NULL,
    "generated_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportRecord_report_type_created_at_idx" ON "ExportRecord"("report_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ExportRecord_generated_by_created_at_idx" ON "ExportRecord"("generated_by", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ExportRecord_status_created_at_idx" ON "ExportRecord"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Approval_status_created_at_idx" ON "Approval"("status", "created_at");

-- CreateIndex
CREATE INDEX "Approval_entity_type_entity_id_idx" ON "Approval"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_to_user_id_active_start_date_end_date_idx" ON "ApprovalDelegation"("to_user_id", "active", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_from_user_id_active_idx" ON "ApprovalDelegation"("from_user_id", "active");

-- CreateIndex
CREATE INDEX "Evidence_task_id_idx" ON "Evidence"("task_id");

-- CreateIndex
CREATE INDEX "Evidence_approval_status_created_at_idx" ON "Evidence"("approval_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Feedback_order_id_idx" ON "Feedback"("order_id");

-- CreateIndex
CREATE INDEX "Feedback_created_at_idx" ON "Feedback"("created_at" DESC);

-- CreateIndex
CREATE INDEX "Feedback_rating_idx" ON "Feedback"("rating");

-- CreateIndex
CREATE INDEX "MenuCategory_brand_id_idx" ON "MenuCategory"("brand_id");

-- CreateIndex
CREATE INDEX "MenuItem_category_id_idx" ON "MenuItem"("category_id");

-- CreateIndex
CREATE INDEX "MenuItem_status_idx" ON "MenuItem"("status");

-- CreateIndex
CREATE INDEX "Order_status_created_at_idx" ON "Order"("status", "created_at");

-- CreateIndex
CREATE INDEX "Order_channel_idx" ON "Order"("channel");

-- CreateIndex
CREATE INDEX "Order_zone_id_status_idx" ON "Order"("zone_id", "status");

-- CreateIndex
CREATE INDEX "OrderItem_order_id_idx" ON "OrderItem"("order_id");

-- CreateIndex
CREATE INDEX "OrderItem_status_ready_at_idx" ON "OrderItem"("status", "ready_at");

-- CreateIndex
CREATE INDEX "OrderItem_menu_item_id_idx" ON "OrderItem"("menu_item_id");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_hash_idx" ON "PasswordResetToken"("token_hash");

-- CreateIndex
CREATE INDEX "PrepBatch_recipe_id_status_zone_id_idx" ON "PrepBatch"("recipe_id", "status", "zone_id");

-- CreateIndex
CREATE INDEX "PrepBatch_zone_id_status_idx" ON "PrepBatch"("zone_id", "status");

-- CreateIndex
CREATE INDEX "PrepBatch_created_at_idx" ON "PrepBatch"("created_at");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_ordered_at_idx" ON "PurchaseOrder"("status", "ordered_at");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendor_id_idx" ON "PurchaseOrder"("vendor_id");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_po_id_idx" ON "PurchaseOrderLine"("po_id");

-- CreateIndex
CREATE INDEX "RecipeLine_recipe_id_idx" ON "RecipeLine"("recipe_id");

-- CreateIndex
CREATE INDEX "RefreshToken_token_hash_idx" ON "RefreshToken"("token_hash");

-- CreateIndex
CREATE INDEX "StockMovement_ingredient_id_created_at_idx" ON "StockMovement"("ingredient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "StockMovement_zone_id_created_at_idx" ON "StockMovement"("zone_id", "created_at");

-- CreateIndex
CREATE INDEX "Task_due_date_status_idx" ON "Task"("due_date", "status");

-- CreateIndex
CREATE INDEX "Task_valid_completed_at_idx" ON "Task"("valid", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "User_status_xp_total_idx" ON "User"("status", "xp_total" DESC);

-- CreateIndex
CREATE INDEX "User_role_id_idx" ON "User"("role_id");

-- CreateIndex
CREATE INDEX "VendorPrice_ingredient_id_effective_date_idx" ON "VendorPrice"("ingredient_id", "effective_date" DESC);

-- CreateIndex
CREATE INDEX "VendorPrice_vendor_id_idx" ON "VendorPrice"("vendor_id");

-- CreateIndex
CREATE INDEX "WasteLog_created_at_idx" ON "WasteLog"("created_at");

-- CreateIndex
CREATE INDEX "WasteLog_zone_id_created_at_idx" ON "WasteLog"("zone_id", "created_at");

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
