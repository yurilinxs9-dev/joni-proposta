-- Extra enrichment columns for agenda_events
ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS descricao    TEXT,
  ADD COLUMN IF NOT EXISTS participantes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS local        TEXT,
  ADD COLUMN IF NOT EXISTS meet_link    TEXT,
  ADD COLUMN IF NOT EXISTS duracao_min  INTEGER;
