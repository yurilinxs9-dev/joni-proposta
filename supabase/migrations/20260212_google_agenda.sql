-- Tabela para armazenar tokens de integração Google
CREATE TABLE public.google_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  calendar_id TEXT DEFAULT 'primary',
  last_sync TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own google integration"
  ON public.google_integrations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own google integration"
  ON public.google_integrations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own google integration"
  ON public.google_integrations FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own google integration"
  ON public.google_integrations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_google_integrations_updated_at
  BEFORE UPDATE ON public.google_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para armazenar eventos detectados da agenda
CREATE TABLE public.agenda_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  cliente_detectado TEXT,
  data_evento TIMESTAMPTZ NOT NULL,
  proposta_id UUID REFERENCES public.propostas(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pendente', -- pendente, vinculado, ignorado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_event_id)
);

ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agenda events"
  ON public.agenda_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own agenda events"
  ON public.agenda_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own agenda events"
  ON public.agenda_events FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own agenda events"
  ON public.agenda_events FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_agenda_events_updated_at
  BEFORE UPDATE ON public.agenda_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
