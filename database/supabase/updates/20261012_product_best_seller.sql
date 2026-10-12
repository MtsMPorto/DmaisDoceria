BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS best_seller boolean NOT NULL DEFAULT false;
COMMIT;
