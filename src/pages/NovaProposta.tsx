import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useCreateProposta, useUpdatePropostaCompleta } from "@/hooks/usePropostas";
import {
  useServicosPersonalizados,
  useCreateServico,
  useDeleteServico,
  useToggleOculto,
} from "@/hooks/useServicosPersonalizados";
import { SERVICOS_PADRAO, type Servico } from "@/types/proposta";
import { useToast } from "@/hooks/use-toast";
import { generatePDF } from "@/lib/generatePDF";
import { ArrowLeft, FileDown, Save, Plus, Settings, Trash2, Eye, EyeOff, Calendar } from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface ServicoComId extends Servico {
  id?: string;
  isCustom?: boolean;
  oculto?: boolean;
}

export default function NovaProposta() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const createProposta = useCreateProposta();
  const updatePropostaCompleta = useUpdatePropostaCompleta();
  const { toast } = useToast();

  // Parâmetros vindos de um lead (Google Agenda)
  const leadCliente = searchParams.get("cliente") || "";
  const leadEmpresa = searchParams.get("empresa") || "";
  const leadWhatsapp = searchParams.get("whatsapp") || "";
  const leadPropostaId = searchParams.get("propostaId") || "";
  const isEditingLead = !!leadPropostaId;

  // Serviços personalizados do banco
  const { data: servicosPersonalizados = [], isLoading: loadingServicos } = useServicosPersonalizados();
  const createServico = useCreateServico();
  const deleteServico = useDeleteServico();
  const toggleOculto = useToggleOculto();

  const [clienteNome, setClienteNome] = useState(leadCliente);
  const [clienteEmpresa, setClienteEmpresa] = useState(leadEmpresa);
  const [clienteWhatsapp, setClienteWhatsapp] = useState(leadWhatsapp);
  const [servicos, setServicos] = useState<ServicoComId[]>([]);
  const [validadeDias, setValidadeDias] = useState("30");
  const [descontoTipo, setDescontoTipo] = useState<"percentual" | "fixo">("percentual");
  const [descontoValor, setDescontoValor] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [step, setStep] = useState<"form" | "resumo">("form");

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Novo serviço
  const [novoNome, setNovoNome] = useState("");
  const [novoDescricao, setNovoDescricao] = useState("");
  const [novoValorMensal, setNovoValorMensal] = useState(0);
  const [novoValorSetup, setNovoValorSetup] = useState(0);
  const [novoTemSetup, setNovoTemSetup] = useState(false);

  // Combinar serviços padrão + personalizados quando carregar
  useEffect(() => {
    const padrao: ServicoComId[] = SERVICOS_PADRAO.map((s) => ({
      ...s,
      isCustom: false,
    }));

    const custom: ServicoComId[] = servicosPersonalizados.map((sp) => ({
      id: sp.id,
      nome: sp.nome,
      descricao: sp.descricao || "",
      valor_mensal: sp.valor_mensal,
      valor_setup: sp.valor_setup,
      temSetup: sp.tem_setup,
      selecionado: false,
      isCustom: true,
      oculto: sp.oculto,
    }));

    // Manter estado de seleção anterior
    setServicos((prev) => {
      const combined = [...padrao, ...custom];
      return combined.map((s) => {
        const existing = prev.find((p) => p.nome === s.nome);
        if (existing) {
          return { ...s, selecionado: existing.selecionado, descricao: existing.descricao };
        }
        return s;
      });
    });
  }, [servicosPersonalizados]);

  const toggleServico = (index: number) => {
    setServicos((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selecionado: !s.selecionado } : s))
    );
  };

  const updateServicoValor = (index: number, field: "valor_mensal" | "valor_setup" | "investimento_trafego", value: number) => {
    setServicos((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const updateServicoDescricao = (index: number, value: string) => {
    setServicos((prev) =>
      prev.map((s, i) => (i === index ? { ...s, descricao: value } : s))
    );
  };

  // Filtrar serviços ocultos na visualização principal
  const servicosVisiveis = servicos.filter((s) => !s.oculto);

  const selecionados = servicos.filter((s) => s.selecionado);
  const subtotalMensal = selecionados.reduce((sum, s) => sum + s.valor_mensal, 0);
  const subtotalSetup = selecionados.reduce((sum, s) => sum + s.valor_setup, 0);
  const subtotal = subtotalMensal + subtotalSetup;
  const desconto =
    descontoTipo === "percentual" ? subtotal * (descontoValor / 100) : descontoValor;
  const valorTotal = Math.max(0, subtotal - desconto);
  const valorMensalFinal = descontoTipo === "percentual"
    ? subtotalMensal * (1 - descontoValor / 100)
    : Math.max(0, subtotalMensal - (subtotalSetup > 0 ? 0 : descontoValor));
  const valorSetupFinal = descontoTipo === "percentual"
    ? subtotalSetup * (1 - descontoValor / 100)
    : Math.max(0, subtotalSetup - (subtotalMensal > 0 ? descontoValor : 0));

  const canSubmit = clienteNome.trim() && selecionados.length > 0;

  const handleAddServico = async () => {
    if (!novoNome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    try {
      await createServico.mutateAsync({
        nome: novoNome,
        descricao: novoDescricao,
        valor_mensal: novoValorMensal,
        valor_setup: novoValorSetup,
        tem_setup: novoTemSetup,
      });
      toast({ title: "Serviço adicionado!" });
      setShowAddModal(false);
      setNovoNome("");
      setNovoDescricao("");
      setNovoValorMensal(0);
      setNovoValorSetup(0);
      setNovoTemSetup(false);
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteServico = async (id: string) => {
    try {
      await deleteServico.mutateAsync(id);
      toast({ title: "Serviço removido!" });
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleOculto = async (id: string, oculto: boolean) => {
    try {
      await toggleOculto.mutateAsync({ id, oculto });
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleSave = async (downloadPDF = false) => {
    try {
      const servicosFormatados = selecionados.map((s) => ({
        servico_nome: s.nome,
        descricao: s.descricao,
        valor_mensal: s.valor_mensal,
        valor_setup: s.valor_setup,
      }));

      const validadeDiasNum = parseInt(validadeDias);

      if (isEditingLead) {
        // Atualizar proposta existente (lead da agenda)
        await updatePropostaCompleta.mutateAsync({
          id: leadPropostaId,
          cliente_nome: clienteNome,
          cliente_empresa: clienteEmpresa || undefined,
          cliente_whatsapp: clienteWhatsapp || undefined,
          valor_mensal: valorMensalFinal,
          valor_setup: valorSetupFinal,
          valor_total: valorTotal,
          desconto_tipo: descontoTipo,
          desconto_valor: descontoValor,
          observacoes: observacoes || undefined,
          validade_dias: validadeDiasNum,
          servicos: servicosFormatados,
        });
      } else {
        // Criar nova proposta
        await createProposta.mutateAsync({
          cliente_nome: clienteNome,
          cliente_empresa: clienteEmpresa || undefined,
          cliente_whatsapp: clienteWhatsapp || undefined,
          valor_mensal: valorMensalFinal,
          valor_setup: valorSetupFinal,
          valor_total: valorTotal,
          desconto_tipo: descontoTipo,
          desconto_valor: descontoValor,
          observacoes: observacoes || undefined,
          criado_por: user?.id,
          validade_dias: validadeDiasNum,
          servicos: servicosFormatados,
        });
      }

      if (downloadPDF) {
        const validadeDate = new Date();
        validadeDate.setDate(validadeDate.getDate() + validadeDiasNum);
        const dataValidadeStr = validadeDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
        await generatePDF({
          clienteNome,
          clienteEmpresa,
          clienteEmail: "",
          clienteWhatsapp,
          servicos: selecionados,
          valorMensal: valorMensalFinal,
          valorSetup: valorSetupFinal,
          valorTotal,
          descontoTipo,
          descontoValor,
          dataValidade: dataValidadeStr,
        });
      }

      toast({ title: isEditingLead ? "Proposta atualizada com sucesso!" : "Proposta salva com sucesso!" });
      navigate("/propostas");
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const isSaving = createProposta.isPending || updatePropostaCompleta.isPending;

  if (step === "resumo") {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setStep("form")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Resumo da Proposta</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Nome:</strong> {clienteNome}</p>
            {clienteEmpresa && <p><strong>Empresa:</strong> {clienteEmpresa}</p>}
            {clienteWhatsapp && <p><strong>WhatsApp:</strong> {clienteWhatsapp}</p>}
            <p><strong>Data:</strong> {new Date().toLocaleDateString("pt-BR")}</p>
            <p><strong>Validade:</strong> {validadeDias} dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Serviços Selecionados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selecionados.map((s) => (
                <div key={s.nome} className="flex justify-between items-start text-sm border-b pb-3">
                  <div className="flex-1 mr-4">
                    <p className="font-medium">{s.nome}</p>
                    <ul className="mt-1 space-y-0.5">
                      {s.descricao.split("\n").filter(l => l.trim()).map((item, i) => (
                        <li key={i} className="text-muted-foreground text-xs">- {item.trim()}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-right shrink-0">
                    {s.valor_mensal > 0 && <p>{formatCurrency(s.valor_mensal)}/mês</p>}
                    {s.investimento_trafego && s.investimento_trafego > 0 && (
                      <p className="text-xs text-muted-foreground">Investimento: {formatCurrency(s.investimento_trafego)}</p>
                    )}
                    {s.valor_setup > 0 && <p className="text-xs text-muted-foreground">Setup: {formatCurrency(s.valor_setup)}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t space-y-1 text-sm">
              <div className="flex justify-between"><span>Mensal:</span><span>{formatCurrency(valorMensalFinal)}</span></div>
              <div className="flex justify-between"><span>Setup:</span><span>{formatCurrency(valorSetupFinal)}</span></div>
              {descontoValor > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Desconto ({descontoTipo === "percentual" ? `${descontoValor}%` : "fixo"}):</span>
                  <span>-{formatCurrency(desconto)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total:</span><span className="text-primary">{formatCurrency(valorTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {observacoes && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Observações</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{observacoes}</p></CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => handleSave(false)} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" /> {isEditingLead ? "Atualizar Proposta" : "Salvar Proposta"}
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => handleSave(true)} disabled={isSaving}>
            <FileDown className="h-4 w-4 mr-2" /> {isEditingLead ? "Atualizar e Baixar PDF" : "Salvar e Baixar PDF"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {isEditingLead ? "Completar Proposta" : "Nova Proposta"}
          </h1>
          {isEditingLead && (
            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 gap-1">
              <Calendar className="h-3 w-3" />
              Lead da Agenda
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1">
          {isEditingLead
            ? `Complete a proposta para ${leadCliente}`
            : "Preencha os dados e selecione os serviços"}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Dados do Cliente</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do cliente *</Label>
              <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input value={clienteEmpresa} onChange={(e) => setClienteEmpresa(e.target.value)} placeholder="Nome da empresa" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={clienteWhatsapp} onChange={(e) => setClienteWhatsapp(e.target.value)} placeholder="(37) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>Validade da proposta</Label>
              <Select value={validadeDias} onValueChange={setValidadeDias}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias (padrão)</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Serviços</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfigModal(true)}
                className="gap-1"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Gerenciar</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAddModal(true)}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Serviço</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingServicos ? (
            <p className="text-sm text-muted-foreground">Carregando serviços...</p>
          ) : (
            servicosVisiveis.map((servico, index) => {
              const realIndex = servicos.findIndex((s) => s.nome === servico.nome);
              return (
                <div key={servico.nome} className={`p-4 rounded-lg border transition-colors ${servico.selecionado ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={servico.selecionado}
                      onCheckedChange={() => toggleServico(realIndex)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{servico.nome}</p>
                        {servico.isCustom && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Personalizado
                          </span>
                        )}
                      </div>
                      {!servico.selecionado && (
                        <ul className="text-sm text-muted-foreground mt-1 space-y-0.5">
                          {servico.descricao.split("\n").filter(l => l.trim()).slice(0, 3).map((item, i) => (
                            <li key={i} className="text-xs">- {item.trim()}</li>
                          ))}
                          {servico.descricao.split("\n").filter(l => l.trim()).length > 3 && (
                            <li className="text-xs text-muted-foreground/60">
                              +{servico.descricao.split("\n").filter(l => l.trim()).length - 3} itens...
                            </li>
                          )}
                        </ul>
                      )}
                      {servico.selecionado && (
                        <div className="space-y-3 mt-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Itens do serviço (um por linha, aparecerão no PDF)</Label>
                            <Textarea
                              value={servico.descricao}
                              onChange={(e) => updateServicoDescricao(realIndex, e.target.value)}
                              rows={Math.min(servico.descricao.split("\n").length + 1, 12)}
                              className="text-sm"
                              placeholder="Planejamento de campanha&#10;Segmentação de público&#10;Relatórios semanais"
                            />
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Valor mensal (R$)</Label>
                              <Input
                                type="number"
                                value={servico.valor_mensal}
                                onChange={(e) => updateServicoValor(realIndex, "valor_mensal", Number(e.target.value))}
                              />
                            </div>
                            {servico.nome.includes("Tráfego") && (
                              <div className="space-y-1">
                                <Label className="text-xs">Investimento em Tráfego (R$)</Label>
                                <Input
                                  type="number"
                                  value={servico.investimento_trafego || 0}
                                  onChange={(e) => updateServicoValor(realIndex, "investimento_trafego", Number(e.target.value))}
                                />
                              </div>
                            )}
                            {servico.temSetup && (
                              <div className="space-y-1">
                                <Label className="text-xs">Valor setup (R$)</Label>
                                <Input
                                  type="number"
                                  value={servico.valor_setup}
                                  onChange={(e) => updateServicoValor(realIndex, "valor_setup", Number(e.target.value))}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Desconto</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de desconto</Label>
              <Select value={descontoTipo} onValueChange={(v) => setDescontoTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{descontoTipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}</Label>
              <Input type="number" value={descontoValor} onChange={(e) => setDescontoValor(Number(e.target.value))} min={0} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Observações internas</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Notas internas sobre esta proposta..."
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="p-4 rounded-lg bg-card border">
        <div className="flex justify-between text-sm"><span>Mensal:</span><span>{formatCurrency(subtotalMensal)}</span></div>
        <div className="flex justify-between text-sm"><span>Setup:</span><span>{formatCurrency(subtotalSetup)}</span></div>
        {descontoValor > 0 && (
          <div className="flex justify-between text-sm text-destructive"><span>Desconto:</span><span>-{formatCurrency(desconto)}</span></div>
        )}
        <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
          <span>Total:</span><span className="text-primary">{formatCurrency(valorTotal)}</span>
        </div>
      </div>

      <Button className="w-full" size="lg" disabled={!canSubmit} onClick={() => setStep("resumo")}>
        Ver Resumo da Proposta
      </Button>

      {/* Modal: Adicionar Novo Serviço */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Serviço Personalizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do serviço *</Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Consultoria de Marketing"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (um item por linha)</Label>
              <Textarea
                value={novoDescricao}
                onChange={(e) => setNovoDescricao(e.target.value)}
                rows={4}
                placeholder="Item 1&#10;Item 2&#10;Item 3"
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Valor mensal (R$)</Label>
                <Input
                  type="number"
                  value={novoValorMensal}
                  onChange={(e) => setNovoValorMensal(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor setup (R$)</Label>
                <Input
                  type="number"
                  value={novoValorSetup}
                  onChange={(e) => setNovoValorSetup(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={novoTemSetup}
                onCheckedChange={setNovoTemSetup}
              />
              <Label className="text-sm">Este serviço tem valor de setup</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddServico} disabled={createServico.isPending}>
              {createServico.isPending ? "Salvando..." : "Salvar Serviço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Gerenciar Serviços */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Serviços</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground mb-4">
              Oculte ou apague serviços personalizados. Serviços ocultos não aparecem na lista, mas podem ser reativados a qualquer momento.
            </p>
            {servicosPersonalizados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Você ainda não criou serviços personalizados.
              </p>
            ) : (
              servicosPersonalizados.map((sp) => (
                <div
                  key={sp.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${sp.oculto ? "bg-muted/50 opacity-60" : ""}`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{sp.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(sp.valor_mensal)}/mês
                      {sp.tem_setup && ` + ${formatCurrency(sp.valor_setup)} setup`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleOculto(sp.id, !sp.oculto)}
                      title={sp.oculto ? "Mostrar" : "Ocultar"}
                    >
                      {sp.oculto ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteServico(sp.id)}
                      title="Apagar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowConfigModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
