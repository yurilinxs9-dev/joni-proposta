import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings, useSaveSetting } from "@/hooks/useAppSettings";
import {
  useGoogleIntegration,
  useAgendaEvents,
  useExchangeGoogleCode,
  useDisconnectGoogle,
  useSyncGoogleCalendar,
  useCreatePropostaFromEvent,
  useIgnoreEvent,
  initiateGoogleOAuth,
  type AgendaEvent,
} from "@/hooks/useGoogleCalendar";
import {
  Calendar,
  RefreshCw,
  Link2Off,
  Check,
  Clock,
  User,
  Plus,
  EyeOff,
  AlertTriangle,
  Loader2,
  Mail,
  Zap,
  Search,
  MousePointer,
  Settings,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle,
  Circle,
  Key,
  ExternalLink,
} from "lucide-react";

// ── Small helper: time-ago label ──────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)} dias`;
}

// ── Copy button helper ────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function Configuracoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading: loadingSettings } = useAppSettings();
  const saveSetting = useSaveSetting();

  const { data: integration, isLoading: loadingIntegration } = useGoogleIntegration();
  const { data: events = [], isLoading: loadingEvents } = useAgendaEvents();
  const exchangeCode = useExchangeGoogleCode();
  const disconnectGoogle = useDisconnectGoogle();
  const syncCalendar = useSyncGoogleCalendar();
  const createPropostaFromEvent = useCreatePropostaFromEvent();
  const ignoreEvent = useIgnoreEvent();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [clientIdInput, setClientIdInput] = useState("");

  // Resolve Google Client ID: DB setting first, env var as fallback
  const googleClientId =
    settings?.google_client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  // Sync input with saved value when settings load
  useEffect(() => {
    if (settings?.google_client_id) {
      setClientIdInput(settings.google_client_id);
    }
  }, [settings?.google_client_id]);

  // ── Handle OAuth callback (?code=... in URL) ────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const codeVerifier = sessionStorage.getItem("google_pkce_verifier");
    sessionStorage.removeItem("google_pkce_verifier");
    window.history.replaceState(null, "", window.location.pathname);

    if (!codeVerifier) {
      toast({
        title: "Erro ao conectar",
        description: "Sessão expirou. Tente novamente.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);

    // Wait for Supabase session to be restored from localStorage before
    // calling the edge function — avoids 401 on page load after OAuth redirect
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente e tente conectar.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      exchangeCode.mutate(
        { code, code_verifier: codeVerifier },
        {
          onSuccess: (data) => {
            toast({
              title: "Google Agenda conectada!",
              description: data.email ? `Conectado como ${data.email}` : "Conta conectada com sucesso.",
            });
            setIsConnecting(false);
            handleSync();
          },
          onError: (error: Error) => {
            toast({ title: "Erro ao conectar", description: error.message, variant: "destructive" });
            setIsConnecting(false);
          },
        },
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    try {
      await initiateGoogleOAuth(googleClientId);
    } catch (err: unknown) {
      toast({
        title: "Erro ao iniciar conexão",
        description: err instanceof Error ? err.message : "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    if (!window.confirm("Tem certeza que deseja desconectar sua conta Google?")) return;
    disconnectGoogle.mutate(undefined, {
      onSuccess: () => toast({ title: "Google Agenda desconectada" }),
      onError: (error: Error) =>
        toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" }),
    });
  };

  const handleSync = () => {
    setIsSyncing(true);
    syncCalendar.mutate(undefined, {
      onSuccess: (data) => {
        const msg =
          data.newEvents > 0
            ? `${data.newEvents} nova${data.newEvents > 1 ? "s" : ""} reunião detectada`
            : "Agenda verificada — sem novidades";
        toast({ title: "Sincronizado!", description: msg });
        setIsSyncing(false);
      },
      onError: (error: Error) => {
        if (error.message === "TOKEN_EXPIRED") {
          toast({
            title: "Reconexão necessária",
            description: "Sua sessão com o Google expirou. Reconecte para continuar.",
            variant: "destructive",
          });
          qc.invalidateQueries({ queryKey: ["google_integration"] });
        } else {
          toast({ title: "Erro na sincronização", description: error.message, variant: "destructive" });
        }
        setIsSyncing(false);
      },
    });
  };

  const handleCreateProposta = (event: AgendaEvent) => {
    createPropostaFromEvent.mutate(event.id, {
      onSuccess: () => {
        toast({ title: "Lead criado!", description: `Proposta para ${event.cliente_detectado} adicionada ao Kanban` });
        navigate("/kanban");
      },
      onError: (error: Error) =>
        toast({ title: "Erro ao criar lead", description: error.message, variant: "destructive" }),
    });
  };

  const handleIgnore = (event: AgendaEvent) => {
    ignoreEvent.mutate(event.id, {
      onSuccess: () => toast({ title: "Evento ignorado" }),
    });
  };

  const handleSaveClientId = () => {
    const trimmed = clientIdInput.trim();
    if (!trimmed) return;
    saveSetting.mutate(
      { key: "google_client_id", value: trimmed },
      {
        onSuccess: () => toast({ title: "Client ID salvo!", description: "Configuração salva com sucesso." }),
        onError: (err: Error) =>
          toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
      },
    );
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const isConnected = !!integration && integration.enabled;
  const needsReconnect = !!integration && !integration.enabled;
  const pendingEvents = events.filter((e) => e.status === "pendente");
  const linkedEvents = events.filter((e) => e.status === "vinculado");

  // Admin checklist status
  const hasClientId = !!googleClientId;
  const edgeFunctionsUrl = "https://supabase.com/dashboard/project/_/functions";

  if (loadingIntegration || loadingSettings || isConnecting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">
            {isConnecting ? "Conectando com Google..." : "Carregando configurações..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* ── Page title ── */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie integrações e preferências</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          STATE 1: NOT CONNECTED
      ══════════════════════════════════════════════════════════════════════ */}
      {!isConnected && !needsReconnect && (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Calendar className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Agenda</CardTitle>
                <CardDescription>Detecte reuniões com clientes e crie leads automaticamente</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* How it works */}
            <div className="grid grid-cols-3 gap-4 py-2">
              {[
                { icon: MousePointer, step: "1. Conecte", desc: "Clique no botão e autorize com sua conta Google" },
                { icon: Search, step: "2. Detectamos", desc: 'Reuniões como "Reunião João" geram leads automáticos' },
                { icon: Zap, step: "3. Crie leads", desc: "Com 1 clique cria proposta no Kanban" },
              ].map(({ icon: Icon, step, desc }) => (
                <div key={step} className="flex flex-col items-center text-center gap-2 p-3 rounded-xl bg-muted/40">
                  <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-xs font-semibold">{step}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{desc}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Button
              size="lg"
              className="w-full gap-2 h-12 text-base"
              onClick={handleConnect}
              disabled={!hasClientId}
            >
              <GoogleIcon />
              Conectar com Google Agenda
            </Button>

            {!hasClientId && (
              <p className="text-center text-xs text-amber-600 font-medium">
                ⚠️ Configure o Google Client ID na seção "Configuração Admin" abaixo antes de conectar.
              </p>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Conexão permanente · Renovação automática de token · Sem anúncios
            </p>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STATE 2: NEEDS RECONNECT
      ══════════════════════════════════════════════════════════════════════ */}
      {needsReconnect && (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1 bg-amber-400" />
          <CardContent className="py-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 rounded-full bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-base">Reconexão necessária</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sua sessão com o Google Agenda expirou. Reconecte para continuar sincronizando.
                </p>
              </div>
              <Button className="gap-2" onClick={handleConnect}>
                <Calendar className="h-4 w-4" />
                Reconectar com Google
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STATE 3: CONNECTED
      ══════════════════════════════════════════════════════════════════════ */}
      {isConnected && (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-500/10">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Google Agenda
                    <Badge className="bg-green-500/10 text-green-700 border-green-200 font-medium text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Conectada
                    </Badge>
                  </CardTitle>
                  {integration.google_email && (
                    <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {integration.google_email}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {integration.last_sync
                  ? `Última sincronização: ${timeAgo(integration.last_sync)}`
                  : "Nunca sincronizado"}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  Sincronizar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Link2Off className="h-4 w-4" />
                  Desconectar
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <strong>Como funciona:</strong> Sincroniza automaticamente a cada 5 minutos.
              Eventos como <em>"Reunião NomeDoCliente"</em> geram leads. Eventos internos (equipe, diretoria) são ignorados.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PENDING EVENTS
      ══════════════════════════════════════════════════════════════════════ */}
      {isConnected && pendingEvents.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <User className="h-4 w-4" />
              Reuniões detectadas ({pendingEvents.length})
            </CardTitle>
            <CardDescription>Clientes identificados — crie o lead ou ignore</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{event.cliente_detectado}</p>
                    <p className="text-xs text-muted-foreground truncate">{event.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      📅{" "}
                      {new Date(event.data_evento).toLocaleString("pt-BR", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-3 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleCreateProposta(event)}
                      disabled={createPropostaFromEvent.isPending}
                      className="gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Criar lead
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleIgnore(event)}
                      title="Ignorar"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked events */}
      {isConnected && linkedEvents.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Convertidos em leads ({linkedEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {linkedEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-2.5 text-sm bg-green-50 border border-green-100 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    <span className="font-medium">{event.cliente_detectado}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(event.data_evento).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs">
                    Proposta criada
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isConnected && events.length === 0 && !loadingEvents && (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="font-medium text-muted-foreground">Nenhuma reunião com cliente detectada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie eventos como <strong>"Reunião NomeDoCliente"</strong> na sua Google Agenda.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADMIN SETUP SECTION (collapsible)
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-slate-400 to-slate-300" />
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors text-left"
          onClick={() => setShowAdmin((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100">
              <Settings className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">Configuração da Integração</p>
              <p className="text-xs text-muted-foreground">
                Configure o Google Client ID e veja o checklist de ativação
              </p>
            </div>
          </div>
          {showAdmin ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showAdmin && (
          <CardContent className="pt-0 pb-6 space-y-6">
            <hr />

            {/* ── STEP 1: Google Cloud Console ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {hasClientId ? (
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <h3 className="font-semibold text-sm">Passo 1 — Google Cloud Console</h3>
              </div>
              <div className="ml-7 space-y-2 text-sm text-muted-foreground">
                <p>Crie as credenciais OAuth no Google:</p>
                <ol className="list-decimal list-inside space-y-1.5 pl-1">
                  <li>
                    Acesse{" "}
                    <a
                      href="https://console.cloud.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline inline-flex items-center gap-1"
                    >
                      console.cloud.google.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>Crie um novo projeto ou selecione um existente</li>
                  <li>
                    Vá em <strong>APIs e Serviços → Biblioteca</strong> → pesquise{" "}
                    <strong>"Google Calendar API"</strong> → Ativar
                  </li>
                  <li>
                    Vá em <strong>APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth</strong>
                  </li>
                  <li>
                    Tipo: <strong>Aplicativo da Web</strong>
                  </li>
                  <li>
                    Em <strong>"Origens JavaScript autorizadas"</strong>, adicione a URL do seu site
                    (ex: <code className="bg-muted px-1 rounded text-xs">https://meusite.vercel.app</code>)
                  </li>
                  <li>
                    Em <strong>"URIs de redirecionamento autorizados"</strong>, adicione:{" "}
                    <code className="bg-muted px-1 rounded text-xs">https://meusite.vercel.app/configuracoes</code>
                  </li>
                  <li>
                    Vá em <strong>Tela de consentimento OAuth</strong> → adicione os e-mails dos usuários como{" "}
                    <strong>"Usuários de teste"</strong>
                  </li>
                  <li>
                    Copie o <strong>Client ID</strong> e o <strong>Client Secret</strong> gerados
                  </li>
                </ol>
              </div>
            </div>

            {/* ── STEP 2: Google Client ID (saved in DB) ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {hasClientId ? (
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <h3 className="font-semibold text-sm">Passo 2 — Cole o Google Client ID aqui</h3>
              </div>
              <div className="ml-7 space-y-2">
                <p className="text-sm text-muted-foreground">
                  O Client ID é público — pode ser salvo aqui com segurança.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9 font-mono text-xs"
                      placeholder="123456789-xxxxxx.apps.googleusercontent.com"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleSaveClientId}
                    disabled={saveSetting.isPending || !clientIdInput.trim()}
                    className="shrink-0"
                  >
                    {saveSetting.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                  </Button>
                </div>
                {hasClientId && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Client ID configurado
                  </p>
                )}
              </div>
            </div>

            {/* ── STEP 3: Deploy Edge Functions ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                <h3 className="font-semibold text-sm">Passo 3 — Deploy das Edge Functions</h3>
              </div>
              <div className="ml-7 space-y-2 text-sm text-muted-foreground">
                <p>
                  Execute no terminal (na pasta do projeto). As Edge Functions ficam no servidor Supabase e
                  mantêm o Client Secret seguro.
                </p>
                <p className="font-medium text-xs text-foreground mb-1">Se ainda não tem o CLI do Supabase:</p>
                <CodeBlock cmd="npm install -g supabase" />
                <p className="font-medium text-xs text-foreground mb-1 mt-3">Login e link do projeto:</p>
                <CodeBlock cmd="npx supabase login" />
                <CodeBlock cmd="npx supabase link" />
                <p className="font-medium text-xs text-foreground mb-1 mt-3">Deploy das funções:</p>
                <CodeBlock cmd="npx supabase functions deploy google-oauth-exchange" />
                <CodeBlock cmd="npx supabase functions deploy google-sync-calendar" />
              </div>
            </div>

            {/* ── STEP 4: Client Secret in Supabase ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                <h3 className="font-semibold text-sm">Passo 4 — Adicionar Client Secret no Supabase</h3>
              </div>
              <div className="ml-7 space-y-2 text-sm text-muted-foreground">
                <p>
                  O Client Secret precisa ficar <strong>no servidor</strong> (nunca no navegador).
                  Adicione via terminal:
                </p>
                <CodeBlock cmd='npx supabase secrets set GOOGLE_CLIENT_ID="seu_client_id"' />
                <CodeBlock cmd='npx supabase secrets set GOOGLE_CLIENT_SECRET="seu_client_secret"' />
                <p className="text-xs mt-2">
                  Ou acesse o{" "}
                  <a
                    href={edgeFunctionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline inline-flex items-center gap-1"
                  >
                    Supabase Dashboard → Edge Functions → Secrets <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  e adicione manualmente.
                </p>
              </div>
            </div>

            {/* ── STEP 5: Migration SQL ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                <h3 className="font-semibold text-sm">Passo 5 — Rodar migration no banco</h3>
              </div>
              <div className="ml-7 space-y-2 text-sm text-muted-foreground">
                <p>
                  Abra o{" "}
                  <a
                    href="https://supabase.com/dashboard/project/_/sql"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline inline-flex items-center gap-1"
                  >
                    Supabase Dashboard → SQL Editor <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  e execute:
                </p>
                <div className="bg-muted rounded-lg p-3 font-mono text-xs space-y-1 relative">
                  <CopyButton
                    text={`ALTER TABLE google_integrations ADD COLUMN IF NOT EXISTS google_email TEXT;\n\nCREATE TABLE IF NOT EXISTS app_settings (\n  key TEXT PRIMARY KEY,\n  value TEXT,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);\nALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "auth_read" ON app_settings FOR SELECT TO authenticated USING (true);\nCREATE POLICY "auth_write" ON app_settings FOR ALL TO authenticated USING (true);`}
                  />
                  <p>ALTER TABLE google_integrations</p>
                  <p className="pl-2">ADD COLUMN IF NOT EXISTS google_email TEXT;</p>
                  <p className="mt-2">CREATE TABLE IF NOT EXISTS app_settings (</p>
                  <p className="pl-2">key TEXT PRIMARY KEY,</p>
                  <p className="pl-2">value TEXT,</p>
                  <p className="pl-2">created_at TIMESTAMPTZ DEFAULT NOW(),</p>
                  <p className="pl-2">updated_at TIMESTAMPTZ DEFAULT NOW()</p>
                  <p>);</p>
                  <p className="mt-1">ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;</p>
                  <p>CREATE POLICY "auth_read" ON app_settings</p>
                  <p className="pl-2">FOR SELECT TO authenticated USING (true);</p>
                  <p>CREATE POLICY "auth_write" ON app_settings</p>
                  <p className="pl-2">FOR ALL TO authenticated USING (true);</p>
                </div>
              </div>
            </div>

            {/* ── Done! ── */}
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm text-green-700">
              <p className="font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Após completar os 5 passos:
              </p>
              <p className="mt-1 text-green-600">
                Qualquer usuário do sistema poderá conectar sua própria Google Agenda clicando em
                "Conectar com Google Agenda" acima — sem depender de você!
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ── Inline helpers ────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function CodeBlock({ cmd }: { cmd: string }) {
  return (
    <div className="flex items-center bg-slate-900 text-green-400 rounded-lg px-3 py-2 font-mono text-xs mt-1">
      <span className="text-slate-500 mr-2 select-none">$</span>
      <span className="flex-1 select-all">{cmd}</span>
      <CopyButton text={cmd} />
    </div>
  );
}
