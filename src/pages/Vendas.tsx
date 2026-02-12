import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import type { PropostaDB, PropostaServicoDB } from "@/types/proposta";

// Cores por categoria
const CATEGORY_COLORS: Record<string, string> = {
  trafego: "#3b82f6",    // Azul
  social: "#ec4899",     // Rosa
  sites: "#10b981",      // Verde
  automacao: "#a855f7",  // Roxo
  outros: "#6b7280",     // Cinza
};

const CATEGORY_LABELS: Record<string, string> = {
  trafego: "Tráfego Pago",
  social: "Social Media",
  sites: "Sites/E-commerce",
  automacao: "Automação",
  outros: "Outros",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  trafego: Megaphone,
  social: Instagram,
  sites: Globe,
  automacao: Zap,
  outros: Package,
};

type PeriodoFiltro = "dia" | "semana" | "mes" | "ano" | "tudo";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function categorizeServico(nome: string): string {
  const lower = nome.toLowerCase();
  if (lower.includes("tráfego") || lower.includes("trafego") || lower.includes("facebook ads")) {
    return "trafego";
  }
  if (lower.includes("social") || lower.includes("mídia") || lower.includes("midia") || lower.includes("instagram")) {
    return "social";
  }
  if (lower.includes("site") || lower.includes("e-commerce") || lower.includes("ecommerce")) {
    return "sites";
  }
  if (lower.includes("automação") || lower.includes("automacao")) {
    return "automacao";
  }
  return "outros";
}

function filterByPeriodo(propostas: PropostaDB[], periodo: PeriodoFiltro): PropostaDB[] {
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
        return (
          created.getMonth() === now.getMonth() &&
          created.getFullYear() === now.getFullYear()
        );
      case "ano":
        return created.getFullYear() === now.getFullYear();
      case "tudo":
      default:
        return true;
    }
  });
}

function filterFechadas(propostas: PropostaDB[]): PropostaDB[] {
  return propostas.filter((p) => p.status === "fechado");
}

export default function Vendas() {
  const { data: propostas = [], isLoading } = usePropostas();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes");

  const filteredPropostas = useMemo(
    () => filterByPeriodo(propostas, periodo),
    [propostas, periodo]
  );

  const fechadas = useMemo(
    () => filterFechadas(filteredPropostas),
    [filteredPropostas]
  );

  // Agregar dados por categoria
  const categoriaStats = useMemo(() => {
    const stats: Record<
      string,
      { quantidade: number; valorTotal: number; valorMensal: number; valorSetup: number }
    > = {
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
        stats[cat].valorMensal += servico.valor_mensal;
        stats[cat].valorSetup += servico.valor_setup;
        stats[cat].valorTotal += servico.valor_mensal + servico.valor_setup;
      });
    });

    return stats;
  }, [fechadas]);

  // Dados para gráficos
  const barData = useMemo(
    () =>
      Object.entries(categoriaStats)
        .map(([key, val]) => ({
          name: CATEGORY_LABELS[key],
          valor: val.valorTotal,
          quantidade: val.quantidade,
          fill: CATEGORY_COLORS[key],
        }))
        .filter((d) => d.valor > 0 || d.quantidade > 0),
    [categoriaStats]
  );

  const pieData = useMemo(
    () =>
      Object.entries(categoriaStats)
        .map(([key, val]) => ({
          name: CATEGORY_LABELS[key],
          value: val.valorTotal,
          fill: CATEGORY_COLORS[key],
        }))
        .filter((d) => d.value > 0),
    [categoriaStats]
  );

  // Evolução mensal (últimos 6 meses)
  const evolutionData = useMemo(() => {
    const months: { mes: string; trafego: number; social: number; sites: number; automacao: number; outros: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString("pt-BR", { month: "short" });
      const monthData = {
        mes: monthName,
        trafego: 0,
        social: 0,
        sites: 0,
        automacao: 0,
        outros: 0,
      };

      propostas
        .filter((p) => {
          const created = new Date(p.created_at);
          return (
            p.status === "fechado" &&
            created.getMonth() === date.getMonth() &&
            created.getFullYear() === date.getFullYear()
          );
        })
        .forEach((proposta) => {
          const servicos = (proposta.proposta_servicos || []) as PropostaServicoDB[];
          servicos.forEach((servico) => {
            const cat = categorizeServico(servico.servico_nome) as keyof typeof monthData;
            if (cat !== "mes") {
              monthData[cat] += servico.valor_mensal + servico.valor_setup;
            }
          });
        });

      months.push(monthData);
    }

    return months;
  }, [propostas]);

  // Totais gerais
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
    mes: "Este Mês",
    ano: "Este Ano",
    tudo: "Todo Período",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Vendas por Serviço</h1>
          <p className="text-muted-foreground mt-1">
            Análise detalhada de vendas fechadas - {periodoLabel[periodo]}
          </p>
        </div>

        {/* Filtro de período */}
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}>
          <TabsList className="grid grid-cols-5 w-full sm:w-auto">
            <TabsTrigger value="dia" className="text-xs">Dia</TabsTrigger>
            <TabsTrigger value="semana" className="text-xs">Semana</TabsTrigger>
            <TabsTrigger value="mes" className="text-xs">Mês</TabsTrigger>
            <TabsTrigger value="ano" className="text-xs">Ano</TabsTrigger>
            <TabsTrigger value="tudo" className="text-xs">Tudo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Vendido
              </p>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold">{formatCurrency(totalGeral)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {fechadas.length} propostas fechadas
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Serviços Vendidos
              </p>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold">{totalServicos}</p>
            <p className="text-xs text-muted-foreground mt-1">itens no período</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ticket Médio
              </p>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Target className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold">
              {formatCurrency(fechadas.length > 0 ? totalGeral / fechadas.length : 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">por proposta</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Taxa Conversão
              </p>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold">
              {filteredPropostas.length > 0
                ? ((fechadas.length / filteredPropostas.length) * 100).toFixed(1)
                : 0}
              %
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {fechadas.length} de {filteredPropostas.length} propostas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards por Categoria */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Vendas por Categoria</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const stat = categoriaStats[key];
            const Icon = CATEGORY_ICONS[key];
            const color = CATEGORY_COLORS[key];

            return (
              <Card
                key={key}
                className="border-0 shadow-md overflow-hidden"
                style={{ borderTop: `3px solid ${color}` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <p className="font-medium text-sm">{label}</p>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(stat.valorTotal)}</p>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>{stat.quantidade} vendas</span>
                    <span>
                      {stat.quantidade > 0
                        ? formatCurrency(stat.valorTotal / stat.quantidade)
                        : "R$ 0"}
                      /un
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Gráfico de Barras */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Comparativo de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("pt-BR", {
                        notation: "compact",
                        compactDisplay: "short",
                      }).format(v)
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12 text-sm">
                Nenhuma venda no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Pizza */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Distribuição por Serviço
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    strokeWidth={2}
                    stroke="hsl(0, 0%, 100%)"
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12 text-sm">
                Nenhuma venda no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Evolução */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Evolução de Vendas (Últimos 6 Meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  new Intl.NumberFormat("pt-BR", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(v)
                }
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                  fontSize: "12px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="trafego"
                name="Tráfego"
                stroke={CATEGORY_COLORS.trafego}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="social"
                name="Social Media"
                stroke={CATEGORY_COLORS.social}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="sites"
                name="Sites"
                stroke={CATEGORY_COLORS.sites}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="automacao"
                name="Automação"
                stroke={CATEGORY_COLORS.automacao}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="outros"
                name="Outros"
                stroke={CATEGORY_COLORS.outros}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Resumo */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Resumo Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-semibold">Categoria</th>
                  <th className="text-center py-3 px-2 font-semibold">Quantidade</th>
                  <th className="text-right py-3 px-2 font-semibold">Mensal</th>
                  <th className="text-right py-3 px-2 font-semibold">Setup</th>
                  <th className="text-right py-3 px-2 font-semibold">Total</th>
                  <th className="text-right py-3 px-2 font-semibold">% do Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                  const stat = categoriaStats[key];
                  const percent =
                    totalGeral > 0 ? ((stat.valorTotal / totalGeral) * 100).toFixed(1) : "0";
                  const Icon = CATEGORY_ICONS[key];

                  return (
                    <tr key={key} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <Icon
                            className="h-4 w-4"
                            style={{ color: CATEGORY_COLORS[key] }}
                          />
                          <span>{label}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">{stat.quantidade}</td>
                      <td className="text-right py-3 px-2">
                        {formatCurrency(stat.valorMensal)}
                      </td>
                      <td className="text-right py-3 px-2">
                        {formatCurrency(stat.valorSetup)}
                      </td>
                      <td className="text-right py-3 px-2 font-medium">
                        {formatCurrency(stat.valorTotal)}
                      </td>
                      <td className="text-right py-3 px-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${CATEGORY_COLORS[key]}20`,
                            color: CATEGORY_COLORS[key],
                          }}
                        >
                          {percent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-semibold">
                  <td className="py-3 px-2">Total</td>
                  <td className="text-center py-3 px-2">{totalServicos}</td>
                  <td className="text-right py-3 px-2">
                    {formatCurrency(
                      Object.values(categoriaStats).reduce((s, v) => s + v.valorMensal, 0)
                    )}
                  </td>
                  <td className="text-right py-3 px-2">
                    {formatCurrency(
                      Object.values(categoriaStats).reduce((s, v) => s + v.valorSetup, 0)
                    )}
                  </td>
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
