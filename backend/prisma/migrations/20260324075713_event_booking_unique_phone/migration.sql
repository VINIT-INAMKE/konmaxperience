/*
  Warnings:

  - A unique constraint covering the columns `[event_id,customer_phone]` on the table `EventBooking` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "EventBooking_event_id_customer_phone_key" ON "EventBooking"("event_id", "customer_phone");
