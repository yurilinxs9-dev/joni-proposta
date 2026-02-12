-- Tabela de serviços personalizados por usuário
CREATE TABLE public.servicos_personalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_mensal NUMERIC NOT NULL DEFAULT 0,
  valor_setup NUMERIC NOT NULL DEFAULT 0,
  tem_setup BOOLEAN DEFAULT false,
  oculto BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servicos_personalizados ENABLE ROW LEVEL SECURITY;

-- Cada usuário só vê seus próprios serviços
CREATE POLICY "Users can view own servicos"
  ON public.servicos_personalizados FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own servicos"
  ON public.servicos_personalizados FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own servicos"
  ON public.servicos_personalizados FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own servicos"
  ON public.servicos_personalizados FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_servicos_personalizados_updated_at
  BEFORE UPDATE ON public.servicos_personalizados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
