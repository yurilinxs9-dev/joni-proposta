-- ── Novas colunas em propostas ───────────────────────────────────────────────
ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE DEFAULT gen_random_uuid()::text;

-- Garante que propostas existentes recebam token
UPDATE propostas SET public_token = gen_random_uuid()::text WHERE public_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_propostas_token ON propostas(public_token);

-- ── Rastreamento de visualizações da proposta pública ─────────────────────────
CREATE TABLE IF NOT EXISTS proposta_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT NOT NULL,
  viewed_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE proposta_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert_anyone" ON proposta_views FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "owner_select"  ON proposta_views FOR SELECT TO authenticated
  USING (token IN (SELECT public_token FROM propostas WHERE criado_por = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_views_token ON proposta_views(token);

-- ── Timeline de atividades por proposta ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposta_atividades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('nota','ligacao','reuniao','status','envio','aceite','visualizacao')),
  descricao   TEXT,
  criado_por  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE proposta_atividades ENABLE ROW LEVEL SECURITY;
-- Usuário autenticado gerencia atividades das próprias propostas
CREATE POLICY "owner_all" ON proposta_atividades FOR ALL TO authenticated
  USING (proposta_id IN (SELECT id FROM propostas WHERE criado_por = auth.uid()))
  WITH CHECK (proposta_id IN (SELECT id FROM propostas WHERE criado_por = auth.uid()));
-- Anon pode inserir (visualização e aceite via link público)
CREATE POLICY "anon_insert" ON proposta_atividades FOR INSERT TO anon WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_atividades_proposta ON proposta_atividades(proposta_id, created_at DESC);
