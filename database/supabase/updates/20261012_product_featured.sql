-- Execute antes de iniciar ou publicar o backend atualizado.
BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
COMMIT;
