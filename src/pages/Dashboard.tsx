import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePropostas } from "@/hooks/usePropostas";
import { useAgendaEvents, useGoogleIntegration } from "@/hooks/useGoogleCalendar";
import { useAppSettings, useSaveSetting } from "@/hooks/useAppSettings";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/proposta";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, FileText, Target, Calendar, Video, MapPin, Clock, Users, ChevronRight, Bell, PhoneCall, Pencil, Check, X, CalendarDays, MessageCircle } from "lucide-react";

const PIE_COLORS = [
  "#3b82f6", "#f59e0b", "#a855f7", "#10b981", "#ef4444",
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

function formatWhatsAppUrl(phone: string, clienteNome?: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  const msg = clienteNome
    ? encodeURIComponent(`Ola ${clienteNome}! Tudo bem? Gostaria de dar um retorno sobre a proposta. Posso te ajudar com alguma duvida?`)
    : "";
  return `https://wa.me/${number}${msg ? `?text=${msg}` : ""}`;
}

type PeriodoFiltro = "semana" | "mes" | "ano" | "custom";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: propostas = [], isLoading } = usePropostas();
  const { data: integration } = useGoogleIntegration();
  const { data: events = [] } = useAgendaEvents();
  const { data: settings } = useAppSettings();
  const saveSetting = useSaveSetting();

  const [editingMeta, setEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  const now = new Date();

  // Filtrar propostas pelo periodo selecionado
  const propostasFiltradas = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return propostas.filter((p) => {
      const created = new Date(p.created_at);
      switch (periodo) {
        case "semana": {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return created >= weekAgo;
        }
        case "mes":
          return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        case "ano":
          return created.getFullYear() === now.getFullYear();
        case "custom": {
          if (!dateRange.from) return true;
          const from = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
          const to = dateRange.to
            ? new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate(), 23, 59, 59)
            : new Date(from.getFullYear(), from.getMonth(), from.getDate(), 23, 59, 59);
          return created >= from && created <= to;
        }
        default:
          return true;
      }
    });
  }, [propostas, periodo, dateRange, now.getMonth(), now.getFullYear()]);

  const totalEnviado = propostasFiltradas.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
  const fechados = propostasFiltradas.filter((p) => p.status === "fechado");
  const totalFechado = fechados.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
  const ticketMedio = propostasFiltradas.length > 0 ? totalEnviado / propostasFiltradas.length : 0;

  // Follow-up: propostas enviadas/negociacao sem movimento ha > 3 dias
  const FOLLOWUP_DIAS = 3;
  const precisamFollowUp = propostas
    .filter((p) =>
      ["proposta_enviada", "em_negociacao"].includes(p.status) &&
      Date.now() - new Date(p.updated_at).getTime() > FOLLOWUP_DIAS * 24 * 60 * 60 * 1000
    )
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());

  // Meta mensal
  const metaMensal = settings?.meta_mensal ? parseFloat(settings.meta_mensal) : null;
  // Meta sempre usa mes atual (independente do filtro)
  const fechadosMesAtual = propostas.filter((p) => {
    const d = new Date(p.created_at);
    return p.status === "fechado" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalFechadoMes = fechadosMesAtual.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
  const metaProgressPct = metaMensal ? Math.min(100, (totalFechadoMes / metaMensal) * 100) : 0;
  const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const diasPassados = now.getDate();
  const projecao = diasPassados > 0 ? (totalFechadoMes / diasPassados) * diasNoMes : 0;

  const handleSaveMeta = async () => {
    const val = parseFloat(metaInput.replace(",", "."));
    if (!isNaN(val) && val > 0) {
      await saveSetting.mutateAsync({ key: "meta_mensal", value: String(val) });
    }
    setEditingMeta(false);
  };

  const statusCounts = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    name: label,
    value: propostasFiltradas.filter((p) => p.status === key).length,
  }));

  const barData = statusCounts.filter((s) => s.value > 0);

  // Upcoming meetings
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingMeetings = events
    .filter((e) => e.status === "pendente" && isUpcoming(e.data_evento))
    .filter((e) => new Date(e.data_evento) <= nextWeek)
    .sort((a, b) => new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime())
    .slice(0, 4);

  const totalPending = events.filter((e) => e.status === "pendente").length;

  const periodoLabels: Record<PeriodoFiltro, string> = {
    semana: "Esta Semana",
    mes: "Este Mes",
    ano: "Este Ano",
    custom: dateRange.from
      ? `${dateRange.from.toLocaleDateString("pt-BR")}${dateRange.to ? ` - ${dateRange.to.toLocaleDateString("pt-BR")}` : ""}`
      : "Periodo personalizado",
  };

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
      subtitle: `${propostasFiltradas.length} propostas`,
      icon: DollarSign,
      gradient: "from-primary/10 to-primary/5",
      iconColor: "text-primary",
    },
    {
      title: "Total Fechado",
      value: formatCurrency(totalFechado),
      subtitle: `${fechados.length} fechadas`,
      icon: TrendingUp,
      gradient: "from-emerald-500/10 to-emerald-500/5",
      iconColor: "text-emerald-500",
    },
    {
      title: "Ticket Medio",
      value: formatCurrency(ticketMedio),
      subtitle: "por proposta",
      icon: Target,
      gradient: "from-amber-500/10 to-amber-500/5",
      iconColor: "text-amber-500",
    },
    {
      title: "Taxa Conversao",
      value: propostasFiltradas.length > 0
        ? `${((fechados.length / propostasFiltradas.length) * 100).toFixed(0)}%`
        : "0%",
      subtitle: `${fechados.length} de ${propostasFiltradas.length}`,
      icon: FileText,
      gradient: "from-purple-500/10 to-purple-500/5",
      iconColor: "text-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Filtros */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Indicadores - {periodoLabels[periodo]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)} className="flex-shrink-0">
            <TabsList className="h-8">
              <TabsTrigger value="semana" className="text-xs h-7 px-2.5">Semana</TabsTrigger>
              <TabsTrigger value="mes" className="text-xs h-7 px-2.5">Mes</TabsTrigger>
              <TabsTrigger value="ano" className="text-xs h-7 px-2.5">Ano</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs h-7 px-2.5">
                <CalendarDays className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Periodo</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {periodo === "custom" && (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {dateRange.from
                    ? `${dateRange.from.toLocaleDateString("pt-BR")}${dateRange.to ? ` - ${dateRange.to.toLocaleDateString("pt-BR")}` : ""}`
                    : "Selecionar datas"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                  onSelect={(range) => {
                    setDateRange({ from: range?.from, to: range?.to });
                    if (range?.to) setCalendarOpen(false);
                  }}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="border-0 shadow-md overflow-hidden">
            <CardContent className="p-0">
              <div className={`p-4 sm:p-5 bg-gradient-to-br ${kpi.gradient}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">{kpi.title}</p>
                  <div className={`p-1.5 sm:p-2 rounded-lg bg-background/80 ${kpi.iconColor}`}>
                    <kpi.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                </div>
                <p className="text-lg sm:text-2xl font-extrabold tracking-tight">{kpi.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{kpi.subtitle}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meta Mensal */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
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
        <CardContent className="space-y-3 px-4 sm:px-6">
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
              <div className="flex justify-between text-xs sm:text-sm mb-1">
                <span className="text-muted-foreground">Fechado: <strong>{formatCurrency(totalFechadoMes)}</strong></span>
                <span className="text-muted-foreground">Meta: <strong>{formatCurrency(metaMensal)}</strong></span>
              </div>
              <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${metaProgressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground pt-1">
                <span>{metaProgressPct.toFixed(0)}% atingida</span>
                <span>Projecao: {formatCurrency(projecao)}</span>
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
          <CardHeader className="pb-3 px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
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
          <CardContent className="px-4 sm:px-6">
            <div className="space-y-2">
              {precisamFollowUp.slice(0, 5).map((p) => {
                const diasSemMovimento = Math.floor((Date.now() - new Date(p.updated_at).getTime()) / (24 * 60 * 60 * 1000));
                return (
                  <div key={p.id} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{p.cliente_empresa || p.cliente_nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-[10px] py-0 ${STATUS_COLORS[p.status]}`}>
                          {STATUS_LABELS[p.status]}
                        </Badge>
                        <span className="text-[10px] sm:text-xs text-amber-700 font-medium">ha {diasSemMovimento}d</span>
                      </div>
                    </div>
                    {p.cliente_whatsapp && (
                      <a
                        href={formatWhatsAppUrl(p.cliente_whatsapp, p.cliente_nome)}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 p-2 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Google Calendar widget */}
      {integration?.enabled && (upcomingMeetings.length > 0 || totalPending > 0) && (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
          <CardHeader className="pb-3 px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Proximas Reunioes
                {totalPending > 0 && (
                  <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-xs">
                    {totalPending}
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground"
                onClick={() => navigate("/configuracoes")}
              >
                Ver <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma reuniao nos proximos 7 dias
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingMeetings.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-muted/40"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-500/10 shrink-0 mt-0.5">
                      <Calendar className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{event.cliente_detectado}</p>
                      <p className="text-xs text-muted-foreground truncate">{event.titulo}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(event.data_evento)}
                        </span>
                        {event.meet_link && (
                          <a href={event.meet_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                            <Video className="h-3 w-3" /> Meet
                          </a>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => navigate("/configuracoes")}>
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
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base font-semibold">Propostas por Etapa</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={30} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', fontSize: '12px' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12 text-sm">Nenhuma proposta no periodo</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base font-semibold">Distribuicao por Status</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={barData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={35}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    strokeWidth={2}
                    stroke="hsl(0, 0%, 100%)"
                  >
                    {barData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12 text-sm">Nenhuma proposta no periodo</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
