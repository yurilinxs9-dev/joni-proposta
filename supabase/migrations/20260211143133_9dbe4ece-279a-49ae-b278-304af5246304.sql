
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Propostas table
CREATE TABLE public.propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome TEXT NOT NULL,
  cliente_empresa TEXT,
  cliente_whatsapp TEXT,
  cliente_email TEXT,
  status TEXT NOT NULL DEFAULT 'novo_lead',
  valor_mensal NUMERIC NOT NULL DEFAULT 0,
  valor_setup NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  desconto_tipo TEXT DEFAULT 'percentual',
  desconto_valor NUMERIC DEFAULT 0,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all propostas"
  ON public.propostas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert propostas"
  ON public.propostas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update propostas"
  ON public.propostas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete propostas"
  ON public.propostas FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_propostas_updated_at
  BEFORE UPDATE ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Proposta serviços table
CREATE TABLE public.proposta_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  servico_nome TEXT NOT NULL,
  descricao TEXT,
  valor_mensal NUMERIC NOT NULL DEFAULT 0,
  valor_setup NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proposta_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all proposta_servicos"
  ON public.proposta_servicos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert proposta_servicos"
  ON public.proposta_servicos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update proposta_servicos"
  ON public.proposta_servicos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete proposta_servicos"
  ON public.proposta_servicos FOR DELETE TO authenticated USING (true);
