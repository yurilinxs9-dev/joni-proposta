import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useGoogleIntegration,
  useAgendaEvents,
  useSaveGoogleIntegration,
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
  Link2,
  Link2Off,
  Check,
  X,
  Clock,
  User,
  Plus,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";

export default function Configuracoes() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: integration, isLoading: loadingIntegration } = useGoogleIntegration();
  const { data: events = [], isLoading: loadingEvents } = useAgendaEvents();
  const saveIntegration = useSaveGoogleIntegration();
  const disconnectGoogle = useDisconnectGoogle();
  const syncCalendar = useSyncGoogleCalendar();
  const createPropostaFromEvent = useCreatePropostaFromEvent();
  const ignoreEvent = useIgnoreEvent();

  const [isSyncing, setIsSyncing] = useState(false);

  // Processar callback OAuth do Google
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");

      if (accessToken) {
        saveIntegration.mutate(accessToken, {
          onSuccess: () => {
            toast({ title: "Google Agenda conectada!" });
            // Limpar hash da URL
            window.history.replaceState(null, "", window.location.pathname);
            // Sincronizar automaticamente
            handleSync(accessToken);
          },
          onError: (error: any) => {
            toast({ title: "Erro ao conectar", description: error.message, variant: "destructive" });
          },
        });
      }
    }
  }, []);

  const handleConnect = () => {
    initiateGoogleOAuth();
  };

  const handleDisconnect = () => {
    if (!window.confirm("Tem certeza que deseja desconectar sua conta Google?")) return;
    disconnectGoogle.mutate(undefined, {
      onSuccess: () => toast({ title: "Google Agenda desconectada" }),
      onError: (error: any) =>
        toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" }),
    });
  };

  const handleSync = async (token?: string) => {
    const accessToken = token || integration?.access_token;
    if (!accessToken) {
      toast({ title: "Nenhuma conta conectada", variant: "destructive" });
      return;
    }

    setIsSyncing(true);
    syncCalendar.mutate(accessToken, {
      onSuccess: (count) => {
        toast({ title: `Sincronizado!`, description: `${count} reuniões com clientes detectadas` });
        setIsSyncing(false);
      },
      onError: (error: any) => {
        toast({ title: "Erro na sincronização", description: error.message, variant: "destructive" });
        setIsSyncing(false);
      },
    });
  };

  const handleCreateProposta = (event: AgendaEvent) => {
    createPropostaFromEvent.mutate(event.id, {
      onSuccess: (proposta) => {
        toast({ title: "Proposta criada!", description: `Lead: ${event.cliente_detectado}` });
        // Redirecionar para a proposta ou Kanban
        navigate("/kanban");
      },
      onError: (error: any) => {
        toast({ title: "Erro ao criar proposta", description: error.message, variant: "destructive" });
      },
    });
  };

  const handleIgnore = (event: AgendaEvent) => {
    ignoreEvent.mutate(event.id, {
      onSuccess: () => toast({ title: "Evento ignorado" }),
    });
  };

  const pendingEvents = events.filter((e) => e.status === "pendente");
  const linkedEvents = events.filter((e) => e.status === "vinculado");
  const ignoredEvents = events.filter((e) => e.status === "ignorado");

  const isConnected = !!integration;
  const lastSync = integration?.last_sync
    ? new Date(integration.last_sync).toLocaleString("pt-BR")
    : "Nunca";

  if (loadingIntegration) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie integrações e preferências</p>
      </div>

      {/* Card Google Agenda */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Agenda</CardTitle>
                <CardDescription>
                  Detecte automaticamente reuniões com clientes e crie leads
                </CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Conectado" : "Desconectado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <div className="text-center py-6">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Conecte sua conta Google para detectar automaticamente reuniões com clientes
              </p>
              <Button onClick={handleConnect} className="gap-2">
                <Link2 className="h-4 w-4" />
                Conectar Google Agenda
              </Button>

              {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Configure <code>VITE_GOOGLE_CLIENT_ID</code> nas variáveis de ambiente
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Última sincronização: {lastSync}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync()}
                    disabled={isSyncing}
                    className="gap-2"
                  >
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

              <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <strong>Como funciona:</strong> O sistema busca eventos com "reunião + NomeCliente"
                na sua agenda e cria cards automaticamente no Kanban. Eventos como "reunião de liderança"
                são ignorados.
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Eventos Pendentes */}
      {isConnected && pendingEvents.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Reuniões Detectadas ({pendingEvents.length})
            </CardTitle>
            <CardDescription>
              Clientes detectados a partir de reuniões na sua agenda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{event.cliente_detectado}</p>
                    <p className="text-sm text-muted-foreground">{event.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      📅 {new Date(event.data_evento).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleCreateProposta(event)}
                      disabled={createPropostaFromEvent.isPending}
                      className="gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Criar Lead
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleIgnore(event)}
                      className="text-muted-foreground"
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

      {/* Eventos Vinculados */}
      {isConnected && linkedEvents.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Vinculados a Propostas ({linkedEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {linkedEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-2 text-sm bg-green-50 border border-green-100 rounded-lg"
                >
                  <div>
                    <span className="font-medium">{event.cliente_detectado}</span>
                    <span className="text-muted-foreground ml-2">
                      {new Date(event.data_evento).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                    Proposta criada
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status vazio */}
      {isConnected && events.length === 0 && !loadingEvents && (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhuma reunião com cliente detectada.
              <br />
              <span className="text-sm">
                Crie eventos como "reunião NomeDoCliente" na sua Google Agenda.
              </span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
