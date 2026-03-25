-- AlterTable
ALTER TABLE "EventBooking" ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "payment_amount" DECIMAL(65,30),
ADD COLUMN     "payment_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "razorpay_order_id" TEXT,
ADD COLUMN     "razorpay_payment_id" TEXT;

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "customer_id" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customer_id" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "razorpay_order_id" TEXT,
ADD COLUMN     "razorpay_payment_id" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_razorpay_order_id_key" ON "EventBooking"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_razorpay_payment_id_key" ON "EventBooking"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "EventBooking_customer_id_idx" ON "EventBooking"("customer_id");

-- CreateIndex
CREATE INDEX "EventBooking_razorpay_order_id_idx" ON "EventBooking"("razorpay_order_id");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBooking" ADD CONSTRAINT "EventBooking_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
