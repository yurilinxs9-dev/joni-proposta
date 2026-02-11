import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePropostas } from "@/hooks/usePropostas";
import { STATUS_LABELS, type StatusProposta } from "@/types/proposta";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, FileText, Target } from "lucide-react";

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

export default function Dashboard() {
  const { data: propostas = [], isLoading } = usePropostas();

  const now = new Date();
  const mesAtual = propostas.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalEnviado = mesAtual.reduce((sum, p) => sum + p.valor_total, 0);
  const fechados = mesAtual.filter((p) => p.status === "fechado");
  const totalFechado = fechados.reduce((sum, p) => sum + p.valor_total, 0);
  const ticketMedio = mesAtual.length > 0 ? totalEnviado / mesAtual.length : 0;

  const statusCounts = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    name: label,
    value: propostas.filter((p) => p.status === key).length,
  }));

  const barData = statusCounts.filter((s) => s.value > 0);

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
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
