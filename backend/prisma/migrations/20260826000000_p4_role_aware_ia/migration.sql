-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('page_view', 'action');

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "user_id" TEXT,
    "role_code" TEXT NOT NULL,
    "event_type" "UsageEventType" NOT NULL,
    "path" TEXT,
    "action" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageEvent_node_id_created_at_idx" ON "UsageEvent"("node_id", "created_at");

-- CreateIndex
CREATE INDEX "UsageEvent_role_code_created_at_idx" ON "UsageEvent"("role_code", "created_at");

-- CreateIndex
CREATE INDEX "UsageEvent_user_id_created_at_idx" ON "UsageEvent"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "UsageEvent_event_type_created_at_idx" ON "UsageEvent"("event_type", "created_at");

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
