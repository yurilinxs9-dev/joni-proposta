import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

export interface GoogleIntegration {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null;
  calendar_id: string;
  last_sync: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgendaEvent {
  id: string;
  user_id: string;
  google_event_id: string;
  titulo: string;
  cliente_detectado: string | null;
  data_evento: string;
  proposta_id: string | null;
  status: string; // 'pendente' | 'vinculado' | 'ignorado'
  created_at: string;
  updated_at: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

// Parser de título para detectar cliente
export function parseEventTitle(titulo: string): { isReuniao: boolean; cliente: string | null } {
  const lower = titulo.toLowerCase();

  // Verifica se contém "reuniao" ou "reunião"
  if (!lower.includes("reuniao") && !lower.includes("reunião")) {
    return { isReuniao: false, cliente: null };
  }

  // Palavras que indicam reunião interna (ignorar)
  const internos = ["lideranca", "liderança", "equipe", "time", "interna", "interno", "diretoria", "gestão", "gestao"];
  if (internos.some((p) => lower.includes(p))) {
    return { isReuniao: true, cliente: null };
  }

  // Extrai nome do cliente (palavra após "reuniao")
  const match = titulo.match(/reuni[aã]o\s+(.+)/i);
  if (match) {
    return { isReuniao: true, cliente: match[1].trim() };
  }

  return { isReuniao: true, cliente: null };
}

// Hook para buscar integração Google do usuário
export function useGoogleIntegration() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["google_integration", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("google_integrations")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
      return (data as GoogleIntegration) || null;
    },
    enabled: !!user,
  });
}

// Hook para buscar eventos da agenda
export function useAgendaEvents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["agenda_events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("agenda_events")
        .select("*")
        .eq("user_id", user.id)
        .order("data_evento", { ascending: true });
      if (error) throw error;
      return (data || []) as AgendaEvent[];
    },
    enabled: !!user,
  });
}

// Iniciar fluxo OAuth do Google
export function initiateGoogleOAuth() {
  if (!GOOGLE_CLIENT_ID) {
    console.error("VITE_GOOGLE_CLIENT_ID não configurado");
    return;
  }

  const redirectUri = `${window.location.origin}/configuracoes`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("scope", GOOGLE_SCOPES);
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "consent");

  window.location.href = authUrl.toString();
}

// Hook para salvar integração Google
export function useSaveGoogleIntegration() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (accessToken: string) => {
      if (!user) throw new Error("Usuário não autenticado");

      // Verificar se já existe integração
      const { data: existing } = await supabase
        .from("google_integrations")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (existing) {
        // Atualizar
        const { error } = await supabase
          .from("google_integrations")
          .update({
            access_token: accessToken,
            token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hora
            enabled: true,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Inserir
        const { error } = await supabase.from("google_integrations").insert({
          user_id: user.id,
          access_token: accessToken,
          token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
          calendar_id: "primary",
          enabled: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["google_integration"] }),
  });
}

// Hook para desconectar Google
export function useDisconnectGoogle() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      const { error } = await supabase
        .from("google_integrations")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["google_integration"] }),
  });
}

// Hook para sincronizar eventos do Google Calendar
export function useSyncGoogleCalendar() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (accessToken: string) => {
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar eventos dos próximos 30 dias
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
          `timeMin=${now.toISOString()}&timeMax=${future.toISOString()}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Token expirado. Reconecte sua conta Google.");
        }
        throw new Error("Erro ao buscar eventos do Google Calendar");
      }

      const data = await response.json();
      const events: GoogleCalendarEvent[] = data.items || [];

      // Processar cada evento
      const processedEvents: Array<{
        google_event_id: string;
        titulo: string;
        cliente_detectado: string | null;
        data_evento: string;
        status: string;
      }> = [];

      for (const event of events) {
        if (!event.summary) continue;

        const parsed = parseEventTitle(event.summary);

        // Só processar se for uma reunião válida com cliente detectado
        if (parsed.isReuniao && parsed.cliente) {
          const dataEvento = event.start.dateTime || event.start.date || now.toISOString();

          processedEvents.push({
            google_event_id: event.id,
            titulo: event.summary,
            cliente_detectado: parsed.cliente,
            data_evento: dataEvento,
            status: "pendente",
          });
        }
      }

      // Inserir/atualizar eventos no banco (upsert)
      for (const evt of processedEvents) {
        const { data: existing } = await supabase
          .from("agenda_events")
          .select("id, status")
          .eq("user_id", user.id)
          .eq("google_event_id", evt.google_event_id)
          .single();

        if (!existing) {
          // Novo evento
          await supabase.from("agenda_events").insert({
            user_id: user.id,
            ...evt,
          });
        }
        // Se já existe, não atualizar para não perder status vinculado
      }

      // Atualizar last_sync
      await supabase
        .from("google_integrations")
        .update({ last_sync: new Date().toISOString() })
        .eq("user_id", user.id);

      return processedEvents.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda_events"] });
      qc.invalidateQueries({ queryKey: ["google_integration"] });
    },
  });
}

// Hook para criar proposta a partir de evento
export function useCreatePropostaFromEvent() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar evento
      const { data: event, error: eventError } = await supabase
        .from("agenda_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError || !event) throw new Error("Evento não encontrado");

      // Criar proposta básica
      const { data: proposta, error: propostaError } = await supabase
        .from("propostas")
        .insert({
          cliente_nome: event.cliente_detectado || "Cliente da Agenda",
          cliente_empresa: event.cliente_detectado,
          status: "novo_lead",
          valor_mensal: 0,
          valor_setup: 0,
          valor_total: 0,
          observacoes: `Criado a partir de reunião: ${event.titulo}\nData: ${new Date(event.data_evento).toLocaleString("pt-BR")}`,
          criado_por: user.id,
        })
        .select()
        .single();

      if (propostaError) throw propostaError;

      // Vincular evento à proposta
      await supabase
        .from("agenda_events")
        .update({
          proposta_id: proposta.id,
          status: "vinculado",
        })
        .eq("id", eventId);

      return proposta;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda_events"] });
      qc.invalidateQueries({ queryKey: ["propostas"] });
    },
  });
}

// Hook para ignorar evento
export function useIgnoreEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("agenda_events")
        .update({ status: "ignorado" })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda_events"] }),
  });
}
