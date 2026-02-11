import { useState } from "react";
import { usePropostas, useDuplicateProposta, useUpdateProposta, useDeleteProposta } from "@/hooks/usePropostas";
import { STATUS_LABELS, STATUS_COLORS, type StatusProposta } from "@/types/proposta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { generatePDF } from "@/lib/generatePDF";
import { Copy, FileDown, Search, Eye, Trash2 } from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function Propostas() {
  const { data: propostas = [], isLoading } = usePropostas();
  const duplicar = useDuplicateProposta();
  const deletar = useDeleteProposta();
  const updateProposta = useUpdateProposta();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState<any>(null);
  const [obs, setObs] = useState("");

  const filtered = propostas.filter(
    (p) =>
      p.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.cliente_empresa?.toLowerCase() || "").includes(busca.toLowerCase())
  );

  const handleDuplicar = async (id: string) => {
    try {
      await duplicar.mutateAsync(id);
      toast({ title: "Proposta duplicada!" });
    } catch {
      toast({ title: "Erro ao duplicar", variant: "destructive" });
    }
  };

  const handleDeletar = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja apagar a proposta de "${nome}"?`)) return;
    try {
      await deletar.mutateAsync(id);
      toast({ title: "Proposta apagada!" });
    } catch {
      toast({ title: "Erro ao apagar", variant: "destructive" });
    }
  };

  const handleDownloadPDF = async (p: any) => {
    const servicos = (p.proposta_servicos || []).map((s: any) => ({
      nome: s.servico_nome,
      descricao: s.descricao || "",
      valor_mensal: s.valor_mensal,
      valor_setup: s.valor_setup,
      selecionado: true,
    }));
    await generatePDF({
      clienteNome: p.cliente_nome,
      clienteEmpresa: p.cliente_empresa || "",
      clienteEmail: p.cliente_email || "",
      clienteWhatsapp: p.cliente_whatsapp || "",
      servicos,
      valorMensal: p.valor_mensal,
      valorSetup: p.valor_setup,
      valorTotal: p.valor_total,
      descontoTipo: p.desconto_tipo || "percentual",
      descontoValor: p.desconto_valor || 0,
    });
  };

  const handleSaveObs = async () => {
    if (!detalhe) return;
    try {
      await updateProposta.mutateAsync({ id: detalhe.id, observacoes: obs });
      toast({ title: "Observações salvas!" });
      setDetalhe(null);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Propostas</h1>
          <p className="text-muted-foreground mt-1">{propostas.length} propostas cadastradas</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou empresa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma proposta encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.cliente_nome}</TableCell>
                    <TableCell>{p.cliente_empresa || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[p.status as StatusProposta]}>
                        {STATUS_LABELS[p.status as StatusProposta]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(p.valor_total)}</TableCell>
                    <TableCell>{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => { setDetalhe(p); setObs(p.observacoes || ""); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(p)}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDuplicar(p.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-red-500 hover:bg-red-50"
                          onClick={() => handleDeletar(p.id, p.cliente_nome)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detalhe} onOpenChange={() => setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Proposta</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>Cliente:</strong> {detalhe.cliente_nome}</div>
                <div><strong>Empresa:</strong> {detalhe.cliente_empresa || "—"}</div>
                <div><strong>Email:</strong> {detalhe.cliente_email || "—"}</div>
                <div><strong>WhatsApp:</strong> {detalhe.cliente_whatsapp || "—"}</div>
                <div><strong>Valor Total:</strong> {formatCurrency(detalhe.valor_total)}</div>
                <div><strong>Status:</strong> {STATUS_LABELS[detalhe.status as StatusProposta]}</div>
              </div>

              {detalhe.proposta_servicos?.length > 0 && (
                <div>
                  <p className="font-medium text-sm mb-2">Serviços:</p>
                  <div className="space-y-1">
                    {detalhe.proposta_servicos.map((s: any) => (
                      <div key={s.id} className="flex justify-between text-sm bg-muted p-2 rounded">
                        <span>{s.servico_nome}</span>
                        <span>
                          {s.valor_mensal > 0 && formatCurrency(s.valor_mensal) + "/mês"}
                          {s.valor_setup > 0 && ` + ${formatCurrency(s.valor_setup)} setup`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Observações internas</label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
                <Button size="sm" onClick={handleSaveObs}>Salvar observações</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
