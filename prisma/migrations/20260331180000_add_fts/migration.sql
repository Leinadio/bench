-- Add tsvector column for full-text search
ALTER TABLE "Section" ADD COLUMN "search_vector" tsvector;

-- Populate search vector
UPDATE "Section" SET "search_vector" = to_tsvector('french', coalesce("heading", '') || ' ' || coalesce("content", ''));

-- Create GIN index for fast search
CREATE INDEX "Section_search_vector_idx" ON "Section" USING GIN ("search_vector");

-- Create trigger to auto-update search vector
CREATE OR REPLACE FUNCTION section_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := to_tsvector('french', coalesce(NEW."heading", '') || ' ' || coalesce(NEW."content", ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER section_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "Section"
  FOR EACH ROW
  EXECUTE FUNCTION section_search_vector_update();
