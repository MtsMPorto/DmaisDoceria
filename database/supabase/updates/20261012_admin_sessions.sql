-- Etapa 1: executar no SQL Editor do projeto Supabase usado pelo backend.
-- Apenas prepara o banco. A revogacao exige integrar login, middleware e logout.
-- Nao altera administradores, senhas, clientes, produtos ou pedidos existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id integer NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz(3) NOT NULL,
  revoked_at timestamptz(3),
  CONSTRAINT admin_sessions_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT admin_sessions_revocation_check CHECK (
    revoked_at IS NULL OR revoked_at >= created_at
  )
);

CREATE INDEX IF NOT EXISTS admin_sessions_admin_id_idx
  ON public.admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx
  ON public.admin_sessions(expires_at);

-- JWTs do Express nao sao sessoes do Supabase Auth.
-- Somente o backend confiavel deve ler/gravar esta tabela.
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_sessions TO service_role;

COMMENT ON TABLE public.admin_sessions IS
  'Sessoes administrativas do backend; nao armazenar tokens JWT nem senhas.';

COMMIT;
