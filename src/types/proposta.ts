export interface Servico {
  nome: string;
  descricao: string;
  valor_mensal: number;
  valor_setup: number;
  investimento_trafego?: number; // Apenas para Tráfego Pago
  selecionado: boolean;
  temSetup?: boolean; // Indica se esse serviço permite setup
}

export const SERVICOS_PADRAO: Servico[] = [
  {
    nome: "Tráfego Pago (Facebook Ads)",
    descricao: [
      "Planejamento de campanha",
      "Criação de estrutura digital (conta de anúncios, verificação, validação)",
      "Segmentação de público",
      "Retenção de audiência",
      "Rastreamento de ações",
      "Remarketing avançado",
      "Relatórios semanais de performance",
      "Interação com público",
      "Roteiros de gravação para vídeos",
      "Gravação de criativos e edição de vídeo",
    ].join("\n"),
    valor_mensal: 1500,
    valor_setup: 0,
    investimento_trafego: 0,
    selecionado: false,
    temSetup: false,
  },
  {
    nome: "Social Media - Plano 3 posts/semana (12/mês)",
    descricao: [
      "Planejamento de marketing",
      "Criação de conteúdo",
      "Layout e designer de post",
      "Programação semanal",
      "Mentoria e técnicas de fotografia e gestão da rede social",
      "Gravação e edição",
    ].join("\n"),
    valor_mensal: 1100,
    valor_setup: 0,
    selecionado: false,
    temSetup: false,
  },
  {
    nome: "Social Media - Plano 5 posts/semana (20/mês)",
    descricao: [
      "Planejamento de marketing",
      "Criação de conteúdo",
      "Layout e designer de post",
      "Programação semanal",
      "Mentoria e técnicas de fotografia e gestão da rede social",
      "Gravação e edição",
    ].join("\n"),
    valor_mensal: 1350,
    valor_setup: 0,
    selecionado: false,
    temSetup: false,
  },
  {
    nome: "Social Media - Plano 7 posts/semana (28/mês)",
    descricao: [
      "Planejamento de marketing",
      "Criação de conteúdo",
      "Layout e designer de post",
      "Programação semanal",
      "Mentoria e técnicas de fotografia e gestão da rede social",
      "Gravação e edição",
    ].join("\n"),
    valor_mensal: 1400,
    valor_setup: 0,
    selecionado: false,
    temSetup: false,
  },
  {
    nome: "Site E-Commerce",
    descricao: [
      "Layout e design moderno e intuitivo para compras",
      "Montagem de páginas conforme solicitação do cliente",
      "Botão de WhatsApp",
      "Flexibilidade para integrações de impulsionamento (Google Ads, Facebook Ads)",
      "SSL Secure Socket Layer (site seguro)",
      "Menu administrativo para alterações",
      "Mentoria por 3 meses para treinamento da plataforma",
    ].join("\n"),
    valor_mensal: 3000,
    valor_setup: 0,
    selecionado: false,
    temSetup: false,
  },
  {
    nome: "Automação",
    descricao: [
      "Implementação de automações de marketing e vendas",
      "Fluxos personalizados de nutrição de leads",
      "Integração com CRM e WhatsApp",
      "Disparo automático de mensagens e emails",
      "Relatórios de conversão e performance",
    ].join("\n"),
    valor_mensal: 497,
    valor_setup: 2000,
    selecionado: false,
    temSetup: true, // Único serviço com setup
  },
];

export type StatusProposta =
  | "novo_lead"
  | "proposta_enviada"
  | "em_negociacao"
  | "fechado"
  | "perdido";

export const STATUS_LABELS: Record<StatusProposta, string> = {
  novo_lead: "Novo Lead",
  proposta_enviada: "Proposta Enviada",
  em_negociacao: "Em Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const STATUS_COLORS: Record<StatusProposta, string> = {
  novo_lead: "bg-blue-50 text-blue-700 border-blue-200",
  proposta_enviada: "bg-amber-50 text-amber-700 border-amber-200",
  em_negociacao: "bg-purple-50 text-purple-700 border-purple-200",
  fechado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  perdido: "bg-red-50 text-red-700 border-red-200",
};

export interface PropostaDB {
  id: string;
  cliente_nome: string;
  cliente_empresa: string | null;
  cliente_whatsapp: string | null;
  cliente_email: string | null;
  status: StatusProposta;
  valor_mensal: number;
  valor_setup: number;
  valor_total: number;
  desconto_tipo: string | null;
  desconto_valor: number | null;
  observacoes: string | null;
  criado_por: string | null;
  public_token: string | null;
  created_at: string;
  updated_at: string;
  proposta_servicos?: PropostaServicoDB[];
}

export type AtividadeTipo = 'nota' | 'ligacao' | 'reuniao' | 'status' | 'envio' | 'aceite' | 'visualizacao';

export interface AtividadeDB {
  id: string;
  proposta_id: string;
  tipo: AtividadeTipo;
  descricao: string | null;
  criado_por: string | null;
  created_at: string;
}

export interface PropostaServicoDB {
  id: string;
  proposta_id: string;
  servico_nome: string;
  descricao: string | null;
  valor_mensal: number;
  valor_setup: number;
  created_at: string;
}
