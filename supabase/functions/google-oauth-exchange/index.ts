import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { code, redirect_uri, code_verifier } = await req.json();

    if (!code || !redirect_uri || !code_verifier) {
      return json({ success: false, error: "Parâmetros inválidos" });
    }

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return json({ success: false, error: "Configuração do Google não encontrada no servidor" });
    }

    // ── 1. Exchange authorization code for tokens ──────────────────────────
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: "authorization_code",
        code_verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.json();
      return json({ success: false, error: err.error_description || "Erro ao autenticar com Google" });
    }

    const tokens = await tokenResponse.json();
    // tokens: { access_token, refresh_token, expires_in, token_type, scope }

    // ── 2. Get the Google user's email ────────────────────────────────────
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = userInfoResponse.ok ? await userInfoResponse.json() : {};

    // ── 3. Authenticate the Supabase user from Bearer JWT ─────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Não autenticado" });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return json({ success: false, error: "Sessão inválida" });

    // ── 4. Store tokens in DB via service role ────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tokenExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    const { data: existing } = await supabaseAdmin
      .from("google_integrations")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("google_integrations")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expiry: tokenExpiry,
          google_email: userInfo.email ?? null,
          enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("google_integrations")
        .insert({
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expiry: tokenExpiry,
          calendar_id: "primary",
          google_email: userInfo.email ?? null,
          enabled: true,
        });
    }

    return json({ success: true, email: userInfo.email ?? null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return json({ success: false, error: message });
  }
});
