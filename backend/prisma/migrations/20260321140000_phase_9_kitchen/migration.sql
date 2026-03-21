-- CreateTable
CREATE TABLE "PrepBatch" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "quantity_produced" DECIMAL(65,30) NOT NULL,
    "quantity_remaining" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "prepared_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteLog" (
    "id" TEXT NOT NULL,
    "waste_type" TEXT NOT NULL,
    "ingredient_id" TEXT,
    "prep_batch_id" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reason_notes" TEXT,
    "cost_impact" DECIMAL(65,30) NOT NULL,
    "logged_by" TEXT,
    "zone_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'placed',
    "table_number" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "delivery_address" TEXT,
    "delivery_assigned_to" TEXT,
    "delivery_status" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "channel_modifier_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(65,30) NOT NULL,
    "item_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ready_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_order_id_key" ON "Payment"("order_id");

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_prep_batch_id_fkey" FOREIGN KEY ("prep_batch_id") REFERENCES "PrepBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
