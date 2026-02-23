import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../shared/cors.ts";

// ── Event title parser ────────────────────────────────────────────────────────
function parseEventTitle(titulo: string): { isReuniao: boolean; cliente: string | null } {
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
        // Permanent token expiry with no refresh token (old implicit-grant sessions)
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

    // ── 4. Fetch calendar events (next 30 days) ────────────────────────────
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const calResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${now.toISOString()}&timeMax=${future.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=250`,
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

      const dataEvento = event.start.dateTime ?? event.start.date ?? now.toISOString();

      const { data: existing } = await supabaseAdmin
        .from("agenda_events")
        .select("id")
        .eq("user_id", user.id)
        .eq("google_event_id", event.id)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("agenda_events").insert({
          user_id: user.id,
          google_event_id: event.id,
          titulo: event.summary,
          cliente_detectado: parsed.cliente,
          data_evento: dataEvento,
          status: "pendente",
        });
        newCount++;
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
