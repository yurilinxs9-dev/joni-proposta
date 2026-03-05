import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { usePropostas } from "@/hooks/usePropostas";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Target,
  Megaphone,
  Instagram,
  Globe,
  Zap,
  Package,
  TrendingUp,
  DollarSign,
  Calendar,
  CalendarDays,
} from "lucide-react";
import type { PropostaDB, PropostaServicoDB } from "@/types/proposta";

const CATEGORY_COLORS: Record<string, string> = {
  trafego: "#3b82f6",
  social: "#ec4899",
  sites: "#10b981",
  automacao: "#a855f7",
  outros: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  trafego: "Trafego Pago",
  social: "Social Media",
  sites: "Sites/E-commerce",
  automacao: "Automacao",
  outros: "Outros",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  trafego: Megaphone,
  social: Instagram,
  sites: Globe,
  automacao: Zap,
  outros: Package,
};

type PeriodoFiltro = "dia" | "semana" | "mes" | "ano" | "tudo" | "custom";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function categorizeServico(nome: string): string {
  const lower = nome.toLowerCase();
  if (lower.includes("trafego") || lower.includes("trafego") || lower.includes("facebook ads")) return "trafego";
  if (lower.includes("social") || lower.includes("midia") || lower.includes("instagram")) return "social";
  if (lower.includes("site") || lower.includes("e-commerce") || lower.includes("ecommerce")) return "sites";
  if (lower.includes("automacao") || lower.includes("automacao")) return "automacao";
  return "outros";
}

function filterByPeriodo(propostas: PropostaDB[], periodo: PeriodoFiltro, dateRange: { from?: Date; to?: Date }): PropostaDB[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return propostas.filter((p) => {
    const created = new Date(p.created_at);
    switch (periodo) {
      case "dia":
        return created >= today;
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
      case "tudo":
      default:
        return true;
    }
  });
}

export default function Vendas() {
  const { data: propostas = [], isLoading } = usePropostas();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  const filteredPropostas = useMemo(
    () => filterByPeriodo(propostas, periodo, dateRange),
    [propostas, periodo, dateRange]
  );

  const fechadas = useMemo(
    () => filteredPropostas.filter((p) => p.status === "fechado"),
    [filteredPropostas]
  );

  const categoriaStats = useMemo(() => {
    const stats: Record<string, { quantidade: number; valorTotal: number; valorMensal: number; valorSetup: number }> = {
      trafego: { quantidade: 0, valorTotal: 0, valorMensal: 0, valorSetup: 0 },
      social: { quantidade: 0, valorTotal: 0, valorMensal: 0, valorSetup: 0 },
      sites: { quantidade: 0, valorTotal: 0, valorMensal: 0, valorSetup: 0 },
      automacao: { quantidade: 0, valorTotal: 0, valorMensal: 0, valorSetup: 0 },
      outros: { quantidade: 0, valorTotal: 0, valorMensal: 0, valorSetup: 0 },
    };

    fechadas.forEach((proposta) => {
      const servicos = (proposta.proposta_servicos || []) as PropostaServicoDB[];
      servicos.forEach((servico) => {
        const cat = categorizeServico(servico.servico_nome);
        stats[cat].quantidade += 1;
        stats[cat].valorMensal += Number(servico.valor_mensal) || 0;
        stats[cat].valorSetup += Number(servico.valor_setup) || 0;
        stats[cat].valorTotal += (Number(servico.valor_mensal) || 0) + (Number(servico.valor_setup) || 0);
      });
    });

    return stats;
  }, [fechadas]);

  const barData = useMemo(
    () =>
      Object.entries(categoriaStats)
        .map(([key, val]) => ({ name: CATEGORY_LABELS[key], valor: val.valorTotal, fill: CATEGORY_COLORS[key] }))
        .filter((d) => d.valor > 0),
    [categoriaStats]
  );

  const pieData = useMemo(
    () =>
      Object.entries(categoriaStats)
        .map(([key, val]) => ({ name: CATEGORY_LABELS[key], value: val.valorTotal, fill: CATEGORY_COLORS[key] }))
        .filter((d) => d.value > 0),
    [categoriaStats]
  );

  const evolutionData = useMemo(() => {
    const months: { mes: string; trafego: number; social: number; sites: number; automacao: number; outros: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString("pt-BR", { month: "short" });
      const monthData = { mes: monthName, trafego: 0, social: 0, sites: 0, automacao: 0, outros: 0 };

      propostas
        .filter((p) => {
          const created = new Date(p.created_at);
          return p.status === "fechado" && created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear();
        })
        .forEach((proposta) => {
          const servicos = (proposta.proposta_servicos || []) as PropostaServicoDB[];
          servicos.forEach((servico) => {
            const cat = categorizeServico(servico.servico_nome) as keyof typeof monthData;
            if (cat !== "mes") {
              monthData[cat] += (Number(servico.valor_mensal) || 0) + (Number(servico.valor_setup) || 0);
            }
          });
        });

      months.push(monthData);
    }
    return months;
  }, [propostas]);

  const totalGeral = useMemo(
    () => Object.values(categoriaStats).reduce((sum, s) => sum + s.valorTotal, 0),
    [categoriaStats]
  );

  const totalServicos = useMemo(
    () => Object.values(categoriaStats).reduce((sum, s) => sum + s.quantidade, 0),
    [categoriaStats]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando vendas...</p>
        </div>
      </div>
    );
  }

  const periodoLabel: Record<PeriodoFiltro, string> = {
    dia: "Hoje",
    semana: "Esta Semana",
    mes: "Este Mes",
    ano: "Este Ano",
    tudo: "Todo Periodo",
    custom: dateRange.from
      ? `${dateRange.from.toLocaleDateString("pt-BR")}${dateRange.to ? ` - ${dateRange.to.toLocaleDateString("pt-BR")}` : ""}`
      : "Periodo personalizado",
  };

  return (
    <div className="space-y-6">
      {/* Header + Filtros */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Vendas por Servico</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Vendas fechadas - {periodoLabel[periodo]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)} className="flex-shrink-0">
            <TabsList className="h-8 flex-wrap">
              <TabsTrigger value="dia" className="text-xs h-7 px-2">Dia</TabsTrigger>
              <TabsTrigger value="semana" className="text-xs h-7 px-2">Semana</TabsTrigger>
              <TabsTrigger value="mes" className="text-xs h-7 px-2">Mes</TabsTrigger>
              <TabsTrigger value="ano" className="text-xs h-7 px-2">Ano</TabsTrigger>
              <TabsTrigger value="tudo" className="text-xs h-7 px-2">Tudo</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs h-7 px-2">
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

      {/* KPI Cards - 2 colunas no mobile */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Vendido</p>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><DollarSign className="h-3.5 w-3.5" /></div>
            </div>
            <p className="text-lg sm:text-2xl font-extrabold">{formatCurrency(totalGeral)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{fechadas.length} propostas</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Servicos</p>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500"><Package className="h-3.5 w-3.5" /></div>
            </div>
            <p className="text-lg sm:text-2xl font-extrabold">{totalServicos}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">no periodo</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ticket Medio</p>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500"><Target className="h-3.5 w-3.5" /></div>
            </div>
            <p className="text-lg sm:text-2xl font-extrabold">{formatCurrency(fechadas.length > 0 ? totalGeral / fechadas.length : 0)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">por proposta</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversao</p>
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500"><TrendingUp className="h-3.5 w-3.5" /></div>
            </div>
            <p className="text-lg sm:text-2xl font-extrabold">
              {filteredPropostas.length > 0 ? ((fechadas.length / filteredPropostas.length) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{fechadas.length} de {filteredPropostas.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards por Categoria - 2 colunas mobile, 5 desktop */}
      <div>
        <h2 className="text-base sm:text-lg font-semibold mb-3">Vendas por Categoria</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const stat = categoriaStats[key];
            const Icon = CATEGORY_ICONS[key];
            const color = CATEGORY_COLORS[key];

            return (
              <Card key={key} className="border-0 shadow-md overflow-hidden" style={{ borderTop: `3px solid ${color}` }}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                    <p className="font-medium text-xs sm:text-sm truncate">{label}</p>
                  </div>
                  <p className="text-base sm:text-xl font-bold">{formatCurrency(stat.valorTotal)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{stat.quantidade} vendas</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Graficos */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base font-semibold">Comparativo de Vendas</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)} width={40} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.12)", fontSize: "12px" }} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12 text-sm">Nenhuma venda no periodo</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base font-semibold">Distribuicao por Servico</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    strokeWidth={2}
                    stroke="hsl(0, 0%, 100%)"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.12)", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12 text-sm">Nenhuma venda no periodo</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evolucao */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2 px-4 sm:px-6">
          <CardTitle className="text-sm sm:text-base font-semibold">Evolucao de Vendas (6 Meses)</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)} width={40} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.12)", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey="trafego" name="Trafego" stroke={CATEGORY_COLORS.trafego} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="social" name="Social" stroke={CATEGORY_COLORS.social} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="sites" name="Sites" stroke={CATEGORY_COLORS.sites} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="automacao" name="Automacao" stroke={CATEGORY_COLORS.automacao} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Resumo - responsiva com cards no mobile */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2 px-4 sm:px-6">
          <CardTitle className="text-sm sm:text-base font-semibold">Resumo Detalhado</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {/* Mobile: lista de cards */}
          <div className="sm:hidden space-y-2">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
              const stat = categoriaStats[key];
              const percent = totalGeral > 0 ? ((stat.valorTotal / totalGeral) * 100).toFixed(0) : "0";
              const Icon = CATEGORY_ICONS[key];
              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Icon className="h-4 w-4 shrink-0" style={{ color: CATEGORY_COLORS[key] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{stat.quantidade} vendas</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(stat.valorTotal)}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${CATEGORY_COLORS[key]}20`, color: CATEGORY_COLORS[key] }}>
                      {percent}%
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 font-semibold">
              <span className="text-sm">Total</span>
              <span className="text-sm">{formatCurrency(totalGeral)}</span>
            </div>
          </div>

          {/* Desktop: tabela */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-semibold">Categoria</th>
                  <th className="text-center py-3 px-2 font-semibold">Qtd</th>
                  <th className="text-right py-3 px-2 font-semibold">Mensal</th>
                  <th className="text-right py-3 px-2 font-semibold">Setup</th>
                  <th className="text-right py-3 px-2 font-semibold">Total</th>
                  <th className="text-right py-3 px-2 font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                  const stat = categoriaStats[key];
                  const percent = totalGeral > 0 ? ((stat.valorTotal / totalGeral) * 100).toFixed(1) : "0";
                  const Icon = CATEGORY_ICONS[key];
                  return (
                    <tr key={key} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: CATEGORY_COLORS[key] }} />
                          <span>{label}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">{stat.quantidade}</td>
                      <td className="text-right py-3 px-2">{formatCurrency(stat.valorMensal)}</td>
                      <td className="text-right py-3 px-2">{formatCurrency(stat.valorSetup)}</td>
                      <td className="text-right py-3 px-2 font-medium">{formatCurrency(stat.valorTotal)}</td>
                      <td className="text-right py-3 px-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${CATEGORY_COLORS[key]}20`, color: CATEGORY_COLORS[key] }}>
                          {percent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-semibold">
                  <td className="py-3 px-2">Total</td>
                  <td className="text-center py-3 px-2">{totalServicos}</td>
                  <td className="text-right py-3 px-2">{formatCurrency(Object.values(categoriaStats).reduce((s, v) => s + v.valorMensal, 0))}</td>
                  <td className="text-right py-3 px-2">{formatCurrency(Object.values(categoriaStats).reduce((s, v) => s + v.valorSetup, 0))}</td>
                  <td className="text-right py-3 px-2">{formatCurrency(totalGeral)}</td>
                  <td className="text-right py-3 px-2">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
