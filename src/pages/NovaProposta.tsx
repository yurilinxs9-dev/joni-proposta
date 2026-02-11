import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useCreateProposta } from "@/hooks/usePropostas";
import { SERVICOS_PADRAO, type Servico } from "@/types/proposta";
import { useToast } from "@/hooks/use-toast";
import { generatePDF } from "@/lib/generatePDF";
import { ArrowLeft, FileDown, Save } from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function NovaProposta() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createProposta = useCreateProposta();
  const { toast } = useToast();

  const [clienteNome, setClienteNome] = useState("");
  const [clienteEmpresa, setClienteEmpresa] = useState("");
  const [clienteWhatsapp, setClienteWhatsapp] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteEndereco, setClienteEndereco] = useState("");
  const [servicos, setServicos] = useState<Servico[]>(SERVICOS_PADRAO.map((s) => ({ ...s })));
  const [descontoTipo, setDescontoTipo] = useState<"percentual" | "fixo">("percentual");
  const [descontoValor, setDescontoValor] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [step, setStep] = useState<"form" | "resumo">("form");

  const toggleServico = (index: number) => {
    setServicos((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selecionado: !s.selecionado } : s))
    );
  };

  const updateServicoValor = (index: number, field: "valor_mensal" | "valor_setup", value: number) => {
    setServicos((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const updateServicoDescricao = (index: number, value: string) => {
    setServicos((prev) =>
      prev.map((s, i) => (i === index ? { ...s, descricao: value } : s))
    );
  };

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

  const handleSave = async (downloadPDF = false) => {
    try {
      const result = await createProposta.mutateAsync({
        cliente_nome: clienteNome,
        cliente_empresa: clienteEmpresa || undefined,
        cliente_whatsapp: clienteWhatsapp || undefined,
        cliente_email: clienteEmail || undefined,
        valor_mensal: valorMensalFinal,
        valor_setup: valorSetupFinal,
        valor_total: valorTotal,
        desconto_tipo: descontoTipo,
        desconto_valor: descontoValor,
        observacoes: observacoes || undefined,
        criado_por: user?.id,
        servicos: selecionados.map((s) => ({
          servico_nome: s.nome,
          descricao: s.descricao,
          valor_mensal: s.valor_mensal,
          valor_setup: s.valor_setup,
        })),
      });

      if (downloadPDF) {
        await generatePDF({
          clienteNome,
          clienteEmpresa,
          clienteEmail,
          clienteWhatsapp,
          clienteEndereco,
          servicos: selecionados,
          valorMensal: valorMensalFinal,
          valorSetup: valorSetupFinal,
          valorTotal,
          descontoTipo,
          descontoValor,
        });
      }

      toast({ title: "Proposta salva com sucesso!" });
      navigate("/propostas");
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

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
            {clienteEmail && <p><strong>Email:</strong> {clienteEmail}</p>}
            {clienteEndereco && <p><strong>Endereço:</strong> {clienteEndereco}</p>}
            <p><strong>Data:</strong> {new Date().toLocaleDateString("pt-BR")}</p>
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
          <Button className="flex-1" onClick={() => handleSave(false)} disabled={createProposta.isPending}>
            <Save className="h-4 w-4 mr-2" /> Salvar Proposta
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => handleSave(true)} disabled={createProposta.isPending}>
            <FileDown className="h-4 w-4 mr-2" /> Salvar e Baixar PDF
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Nova Proposta</h1>
        <p className="text-muted-foreground mt-1">Preencha os dados e selecione os serviços</p>
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
              <Input value={clienteWhatsapp} onChange={(e) => setClienteWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} placeholder="email@empresa.com" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Endereço</Label>
              <Input value={clienteEndereco} onChange={(e) => setClienteEndereco(e.target.value)} placeholder="Rua, número - Bairro" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Serviços</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {servicos.map((servico, index) => (
            <div key={servico.nome} className={`p-4 rounded-lg border transition-colors ${servico.selecionado ? "border-primary bg-primary/5" : ""}`}>
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={servico.selecionado}
                  onCheckedChange={() => toggleServico(index)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-medium">{servico.nome}</p>
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
                          onChange={(e) => updateServicoDescricao(index, e.target.value)}
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
                            onChange={(e) => updateServicoValor(index, "valor_mensal", Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Valor setup (R$)</Label>
                          <Input
                            type="number"
                            value={servico.valor_setup}
                            onChange={(e) => updateServicoValor(index, "valor_setup", Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
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
    </div>
  );
}
