-- Step 1: Add search_text column
ALTER TABLE "GuidePage" ADD COLUMN "search_text" TEXT NOT NULL DEFAULT '';

-- Step 2: Backfill existing rows (extract text from Tiptap JSON)
UPDATE "GuidePage"
SET "search_text" = title || ' ' ||
  COALESCE(regexp_replace(content, '"text":"([^"]+)"', '\1 ', 'g'), '');

-- Step 3: Trigger function to keep search_text in sync on INSERT/UPDATE
CREATE OR REPLACE FUNCTION guide_page_search_text_sync()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text :=
    NEW.title || ' ' ||
    COALESCE(
      regexp_replace(NEW.content::text, '"text":"([^"]+)"', '\1 ', 'g'),
      ''
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Attach trigger
DROP TRIGGER IF EXISTS guide_page_search_text_trigger ON "GuidePage";
CREATE TRIGGER guide_page_search_text_trigger
BEFORE INSERT OR UPDATE OF content, title
ON "GuidePage"
FOR EACH ROW EXECUTE FUNCTION guide_page_search_text_sync();

-- Step 5: GIN index for fast tsvector search
CREATE INDEX "GuidePage_search_text_gin_idx"
ON "GuidePage" USING GIN (to_tsvector('english', search_text));
