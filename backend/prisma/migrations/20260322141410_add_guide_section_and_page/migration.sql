-- CreateTable
CREATE TABLE "GuideSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "accent_color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "role_codes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidePage" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "estimated_read_time" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidePage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuideSection_slug_key" ON "GuideSection"("slug");

-- CreateIndex
CREATE INDEX "GuideSection_status_idx" ON "GuideSection"("status");

-- CreateIndex
CREATE INDEX "GuideSection_sort_order_idx" ON "GuideSection"("sort_order");

-- CreateIndex
CREATE INDEX "GuidePage_section_id_sort_order_idx" ON "GuidePage"("section_id", "sort_order");

-- CreateIndex
CREATE INDEX "GuidePage_status_idx" ON "GuidePage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GuidePage_section_id_slug_key" ON "GuidePage"("section_id", "slug");

-- AddForeignKey
ALTER TABLE "GuidePage" ADD CONSTRAINT "GuidePage_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "GuideSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
