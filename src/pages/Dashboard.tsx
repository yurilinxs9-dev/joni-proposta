import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePropostas } from "@/hooks/usePropostas";
import { useAgendaEvents, useGoogleIntegration } from "@/hooks/useGoogleCalendar";
import { useAppSettings, useSaveSetting } from "@/hooks/useAppSettings";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/proposta";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, FileText, Target, Calendar, Video, MapPin, Clock, Users, ChevronRight, Bell, PhoneCall, Pencil, Check, X } from "lucide-react";

// Colors matching the Kanban columns (funnel stages)
const PIE_COLORS = [
  "#3b82f6", // Novo Lead — blue
  "#f59e0b", // Proposta Enviada — amber
  "#a855f7", // Em Negociação — purple
  "#10b981", // Fechado — emerald
  "#ef4444", // Perdido — red
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function isUpcoming(iso: string) {
  return new Date(iso) >= new Date();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: propostas = [], isLoading } = usePropostas();
  const { data: integration } = useGoogleIntegration();
  const { data: events = [] } = useAgendaEvents();
  const { data: settings } = useAppSettings();
  const saveSetting = useSaveSetting();

  const [editingMeta, setEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");

  const now = new Date();
  const mesAtual = propostas.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalEnviado = mesAtual.reduce((sum, p) => sum + p.valor_total, 0);
  const fechados = mesAtual.filter((p) => p.status === "fechado");
  const totalFechado = fechados.reduce((sum, p) => sum + p.valor_total, 0);
  const ticketMedio = mesAtual.length > 0 ? totalEnviado / mesAtual.length : 0;

  // Follow-up: propostas enviadas/negociação sem movimento há > 3 dias
  const FOLLOWUP_DIAS = 3;
  const precisamFollowUp = propostas
    .filter((p) =>
      ["proposta_enviada", "em_negociacao"].includes(p.status) &&
      Date.now() - new Date(p.updated_at).getTime() > FOLLOWUP_DIAS * 24 * 60 * 60 * 1000
    )
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());

  // Meta mensal
  const metaMensal = settings?.meta_mensal ? parseFloat(settings.meta_mensal) : null;
  const metaProgressPct = metaMensal ? Math.min(100, (totalFechado / metaMensal) * 100) : 0;
  const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const diasPassados = now.getDate();
  const projecao = diasPassados > 0 ? (totalFechado / diasPassados) * diasNoMes : 0;

  const handleSaveMeta = async () => {
    const val = parseFloat(metaInput.replace(",", "."));
    if (!isNaN(val) && val > 0) {
      await saveSetting.mutateAsync({ key: "meta_mensal", value: String(val) });
    }
    setEditingMeta(false);
  };

  const statusCounts = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    name: label,
    value: propostas.filter((p) => p.status === key).length,
  }));

  const barData = statusCounts.filter((s) => s.value > 0);

  // Upcoming meetings (pendente + future date, next 7 days)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingMeetings = events
    .filter((e) => e.status === "pendente" && isUpcoming(e.data_evento))
    .filter((e) => new Date(e.data_evento) <= nextWeek)
    .sort((a, b) => new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime())
    .slice(0, 4);

  // All pending (for badge count in widget header)
  const totalPending = events.filter((e) => e.status === "pendente").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Total Enviado",
      value: formatCurrency(totalEnviado),
      subtitle: `${mesAtual.length} propostas no mês`,
      icon: DollarSign,
      gradient: "from-primary/10 to-primary/5",
      iconColor: "text-primary",
    },
    {
      title: "Total Fechado",
      value: formatCurrency(totalFechado),
      subtitle: `${fechados.length} propostas fechadas`,
      icon: TrendingUp,
      gradient: "from-success/10 to-success/5",
      iconColor: "text-success",
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(ticketMedio),
      subtitle: "por proposta",
      icon: Target,
      gradient: "from-warning/10 to-warning/5",
      iconColor: "text-warning",
    },
    {
      title: "Total Propostas",
      value: String(propostas.length),
      subtitle: "desde o início",
      icon: FileText,
      gradient: "from-info/10 to-info/5",
      iconColor: "text-info",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Indicadores do mês atual</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="card-hover border-0 shadow-md overflow-hidden">
            <CardContent className="p-0">
              <div className={`p-5 bg-gradient-to-br ${kpi.gradient}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{kpi.title}</p>
                  <div className={`p-2 rounded-lg bg-background/80 ${kpi.iconColor}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold tracking-tight">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meta Mensal */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-500" />
              Meta Mensal
            </CardTitle>
            {!editingMeta && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => { setMetaInput(metaMensal ? String(metaMensal) : ""); setEditingMeta(true); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {editingMeta ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Ex: 10000"
                value={metaInput}
                onChange={(e) => setMetaInput(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveMeta(); if (e.key === "Escape") setEditingMeta(false); }}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={handleSaveMeta} disabled={saveSetting.isPending}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingMeta(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : metaMensal ? (
            <>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Fechado: <strong>{formatCurrency(totalFechado)}</strong></span>
                <span className="text-muted-foreground">Meta: <strong>{formatCurrency(metaMensal)}</strong></span>
              </div>
              <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${metaProgressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>{metaProgressPct.toFixed(0)}% da meta atingida</span>
                <span>Projeção: {formatCurrency(projecao)}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-3 space-y-2">
              <p className="text-sm text-muted-foreground">Defina sua meta de fechamento mensal</p>
              <Button size="sm" variant="outline" onClick={() => { setMetaInput(""); setEditingMeta(true); }}>
                Definir meta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-up Pendente */}
      {precisamFollowUp.length > 0 && (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                Follow-up Pendente
                <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-xs">
                  {precisamFollowUp.length}
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => navigate("/propostas")}>
                Ver todas <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {precisamFollowUp.slice(0, 5).map((p) => {
                const diasSemMovimento = Math.floor((Date.now() - new Date(p.updated_at).getTime()) / (24 * 60 * 60 * 1000));
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0">
                      <PhoneCall className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{p.cliente_empresa || p.cliente_nome}</p>
                      {p.cliente_empresa && <p className="text-xs text-muted-foreground truncate">{p.cliente_nome}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={STATUS_COLORS[p.status]} >{STATUS_LABELS[p.status]}</Badge>
                      <span className="text-xs text-amber-700 font-medium whitespace-nowrap">há {diasSemMovimento}d</span>
                      {p.cliente_whatsapp && (
                        <a
                          href={`https://wa.me/55${p.cliente_whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 hover:text-emerald-700"
                          title="WhatsApp"
                        >
                          <PhoneCall className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Google Calendar widget — only if connected and has upcoming meetings */}
      {integration?.enabled && (upcomingMeetings.length > 0 || totalPending > 0) && (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Próximas Reuniões
                {totalPending > 0 && (
                  <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-xs">
                    {totalPending} pendente{totalPending > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground"
                onClick={() => navigate("/configuracoes")}
              >
                Ver todas <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma reunião nos próximos 7 dias
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingMeetings.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-500/10 shrink-0 mt-0.5">
                      <Calendar className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{event.cliente_detectado}</p>
                      <p className="text-xs text-muted-foreground truncate">{event.titulo}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(event.data_evento)}
                          {event.duracao_min && ` · ${event.duracao_min}min`}
                        </span>
                        {event.meet_link && (
                          <a
                            href={event.meet_link}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                          >
                            <Video className="h-3 w-3" />
                            Meet
                          </a>
                        )}
                        {event.local && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {event.local}
                          </span>
                        )}
                        {event.participantes && event.participantes.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {event.participantes.length} participante{event.participantes.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-7 text-xs"
                      onClick={() => navigate("/configuracoes")}
                    >
                      Criar lead
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Propostas por Etapa</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12 text-sm">
                Nenhuma proposta ainda
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={barData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={40}
                    label
                    strokeWidth={2}
                    stroke="hsl(0, 0%, 100%)"
                  >
                    {barData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12 text-sm">
                Nenhuma proposta ainda
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
