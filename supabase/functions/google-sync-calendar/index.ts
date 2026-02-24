import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../shared/cors.ts";

// ── Internal-meeting keywords (skip these) ────────────────────────────────────
const INTERNAL_KEYWORDS = [
  "lideranca", "liderança", "equipe", "time", "interna", "interno",
  "diretoria", "gestão", "gestao", "1:1", "one on one", "onboarding",
  "all hands", "alinhamento interno", "retrospectiva", "sprint",
];

// ── Client-meeting patterns (order matters — more specific first) ──────────────
const CLIENT_PATTERNS: RegExp[] = [
  /reuni[aã]o\s+(?:com\s+)?(.+)/i,
  /apresenta[cç][aã]o\s+(?:para\s+|a\s+|com\s+)?(.+)/i,
  /demo\s+(?:com\s+|para\s+)?(.+)/i,
  /visita\s+(?:a\s+|ao?\s+)?(.+)/i,
  /call\s+(?:com\s+)?(.+)/i,
  /meeting\s+(?:with\s+|com\s+)?(.+)/i,
];

function parseEventTitle(titulo: string): { isReuniao: boolean; cliente: string | null } {
  const lower = titulo.toLowerCase();

  // Skip purely internal meetings
  if (INTERNAL_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { isReuniao: true, cliente: null };
  }

  for (const pattern of CLIENT_PATTERNS) {
    const match = titulo.match(pattern);
    if (match) {
      const cliente = match[1].trim().replace(/[()[\]]/g, "").trim();
      if (cliente.length < 2) return { isReuniao: true, cliente: null };
      return { isReuniao: true, cliente };
    }
  }

  return { isReuniao: false, cliente: null };
}

// ── Token refresh ─────────────────────────────────────────────────────────────
async function refreshGoogleToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error_description || "Falha ao renovar token");
  }
  return response.json() as Promise<{ access_token: string; expires_in: number }>;
}

// ── Extract Google Meet link from event ───────────────────────────────────────
function extractMeetLink(event: Record<string, unknown>): string | null {
  if (event.hangoutLink) return event.hangoutLink as string;
  const conf = event.conferenceData as Record<string, unknown> | undefined;
  if (conf?.entryPoints) {
    const points = conf.entryPoints as Array<Record<string, string>>;
    const video = points.find((ep) => ep.entryPointType === "video");
    if (video?.uri) return video.uri;
  }
  return null;
}

// ── Calculate duration in minutes ────────────────────────────────────────────
function calcDuration(event: Record<string, unknown>): number | null {
  const start = (event.start as Record<string, string>)?.dateTime;
  const end = (event.end as Record<string, string>)?.dateTime;
  if (!start || !end) return null;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── 1. Authenticate user ───────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Não autenticado" });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return json({ success: false, error: "Sessão inválida" });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 2. Get integration from DB ─────────────────────────────────────────
    const { data: integration } = await supabaseAdmin
      .from("google_integrations")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!integration) {
      return json({ success: false, error: "Integração não encontrada. Conecte o Google Agenda primeiro." });
    }
    if (!integration.enabled) {
      return json({ success: false, code: "TOKEN_EXPIRED", error: "Reconexão com Google necessária" });
    }

    // ── 3. Check / refresh access token ───────────────────────────────────
    let accessToken: string = integration.access_token;
    const tokenExpiry = integration.token_expiry ? new Date(integration.token_expiry) : null;
    const isExpired = !tokenExpiry || tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000;

    if (isExpired) {
      if (!integration.refresh_token) {
        await supabaseAdmin
          .from("google_integrations")
          .update({ enabled: false })
          .eq("user_id", user.id);
        return json({ success: false, code: "TOKEN_EXPIRED", error: "Reconexão com Google necessária" });
      }

      const refreshed = await refreshGoogleToken(integration.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabaseAdmin
        .from("google_integrations")
        .update({ access_token: accessToken, token_expiry: newExpiry })
        .eq("user_id", user.id);
    }

    // ── 4. Fetch calendar events (last 7 days + next 30 days) ─────────────
    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const calResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${past.toISOString()}&timeMax=${future.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!calResponse.ok) {
      if (calResponse.status === 401) {
        await supabaseAdmin
          .from("google_integrations")
          .update({ enabled: false })
          .eq("user_id", user.id);
        return json({ success: false, code: "TOKEN_EXPIRED", error: "Reconexão com Google necessária" });
      }
      return json({ success: false, error: "Erro ao buscar eventos do Google Calendar" });
    }

    const calData = await calResponse.json();
    const events = calData.items ?? [];

    // ── 5. Parse & store new meetings ─────────────────────────────────────
    let newCount = 0;
    for (const event of events) {
      if (!event.summary) continue;
      const parsed = parseEventTitle(event.summary);
      if (!parsed.isReuniao || !parsed.cliente) continue;

      const dataEvento = event.start?.dateTime ?? event.start?.date ?? now.toISOString();

      const { data: existing } = await supabaseAdmin
        .from("agenda_events")
        .select("id")
        .eq("user_id", user.id)
        .eq("google_event_id", event.id)
        .maybeSingle();

      // Extract enrichment data
      const participantes: string[] = (event.attendees ?? [])
        .map((a: Record<string, string>) => a.email)
        .filter(Boolean);
      const meetLink = extractMeetLink(event);
      const duracaoMin = calcDuration(event);
      const descricao = event.description
        ? String(event.description).replace(/<[^>]*>/g, "").slice(0, 500)
        : null;
      const local = event.location ?? null;

      if (!existing) {
        await supabaseAdmin.from("agenda_events").insert({
          user_id: user.id,
          google_event_id: event.id,
          titulo: event.summary,
          cliente_detectado: parsed.cliente,
          data_evento: dataEvento,
          status: "pendente",
          descricao,
          participantes,
          local,
          meet_link: meetLink,
          duracao_min: duracaoMin,
        });
        newCount++;
      } else {
        // Update enrichment fields even for existing events (in case they changed)
        await supabaseAdmin
          .from("agenda_events")
          .update({ descricao, participantes, local, meet_link: meetLink, duracao_min: duracaoMin })
          .eq("id", existing.id);
      }
    }

    // ── 6. Update last_sync ────────────────────────────────────────────────
    await supabaseAdmin
      .from("google_integrations")
      .update({ last_sync: new Date().toISOString() })
      .eq("user_id", user.id);

    return json({ success: true, newEvents: newCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return json({ success: false, error: message });
  }
});
