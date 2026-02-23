import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export interface GoogleIntegration {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null;
  calendar_id: string;
  last_sync: string | null;
  enabled: boolean;
  google_email: string | null;
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

// ── PKCE helpers ──────────────────────────────────────────────────────────────
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return { verifier, challenge };
}

// ── Initiate OAuth (Authorization Code + PKCE) ────────────────────────────────
// clientId: read from app_settings in DB (or fallback to VITE_GOOGLE_CLIENT_ID env)
export async function initiateGoogleOAuth(clientId: string): Promise<void> {
  if (!clientId) {
    throw new Error("Google Client ID não configurado. Configure na seção de Administração abaixo.");
  }

  const { verifier, challenge } = await generatePKCE();
  sessionStorage.setItem("google_pkce_verifier", verifier);

  const redirectUri = `${window.location.origin}/configuracoes`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent"); // ensures refresh_token is always returned
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  window.location.href = authUrl.toString();
}

// ── Hook: fetch user's Google integration ─────────────────────────────────────
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
        .maybeSingle();
      if (error) throw error;
      return (data as GoogleIntegration) || null;
    },
    enabled: !!user,
  });
}

// ── Hook: fetch agenda events ─────────────────────────────────────────────────
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

// ── Hook: exchange OAuth code → tokens (via edge function) ────────────────────
export function useExchangeGoogleCode() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      code,
      code_verifier,
    }: {
      code: string;
      code_verifier: string;
    }) => {
      const redirect_uri = `${window.location.origin}/configuracoes`;

      const { data, error } = await supabase.functions.invoke("google-oauth-exchange", {
        body: { code, redirect_uri, code_verifier },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erro ao conectar com Google");

      return data as { success: true; email: string | null };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["google_integration"] }),
  });
}

// ── Hook: sync calendar events (via edge function, auto-refreshes token) ──────
export function useSyncGoogleCalendar() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-sync-calendar");

      if (error) throw new Error(error.message);

      if (!data?.success) {
        if (data?.code === "TOKEN_EXPIRED") {
          throw new Error("TOKEN_EXPIRED");
        }
        throw new Error(data?.error || "Erro na sincronização");
      }

      return data as { success: true; newEvents: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda_events"] });
      qc.invalidateQueries({ queryKey: ["google_integration"] });
    },
  });
}

// ── Hook: disconnect Google ───────────────────────────────────────────────────
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

// ── Hook: create proposal from agenda event ───────────────────────────────────
export function useCreatePropostaFromEvent() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { data: event, error: eventError } = await supabase
        .from("agenda_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError || !event) throw new Error("Evento não encontrado");

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

      await supabase
        .from("agenda_events")
        .update({ proposta_id: proposta.id, status: "vinculado" })
        .eq("id", eventId);

      return proposta;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda_events"] });
      qc.invalidateQueries({ queryKey: ["propostas"] });
    },
  });
}

// ── Hook: ignore event ────────────────────────────────────────────────────────
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

// ── Parser (kept for reference / shared usage) ────────────────────────────────
export function parseEventTitle(titulo: string): { isReuniao: boolean; cliente: string | null } {
  const lower = titulo.toLowerCase();
  if (!lower.includes("reuniao") && !lower.includes("reunião")) {
    return { isReuniao: false, cliente: null };
  }
  const internos = [
    "lideranca", "liderança", "equipe", "time", "interna", "interno",
    "diretoria", "gestão", "gestao",
  ];
  if (internos.some((p) => lower.includes(p))) {
    return { isReuniao: true, cliente: null };
  }
  const match = titulo.match(/reuni[aã]o\s+(.+)/i);
  if (match) return { isReuniao: true, cliente: match[1].trim() };
  return { isReuniao: true, cliente: null };
}
