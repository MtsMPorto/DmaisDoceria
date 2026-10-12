BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS archived_at timestamptz;
COMMIT;
