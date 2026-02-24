import { useState, useMemo } from "react";
import { usePropostas, useDuplicateProposta, useUpdateProposta, useDeleteProposta } from "@/hooks/usePropostas";
import { STATUS_LABELS, STATUS_COLORS, type StatusProposta } from "@/types/proposta";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { generatePDF } from "@/lib/generatePDF";
import { Copy, FileDown, Search, Eye, Trash2, MessageCircle, Filter, MoreVertical } from "lucide-react";

// Categorias de serviço
const CATEGORIAS = {
  todos: "Todos os Serviços",
  trafego: "Tráfego Pago",
  social: "Social Media",
  sites: "Sites/E-commerce",
  automacao: "Automação",
  outros: "Outros/Personalizados",
} as const;

type CategoriaFiltro = keyof typeof CATEGORIAS;

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatWhatsAppUrl(phone: string, clienteNome?: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  const msg = clienteNome
    ? encodeURIComponent(`Olá ${clienteNome}! Tudo bem? Segue nossa proposta comercial. Qualquer dúvida estou à disposição! 😊`)
    : "";
  return `https://wa.me/${number}${msg ? `?text=${msg}` : ""}`;
}

export default function Propostas() {
  const { data: propostas = [], isLoading } = usePropostas();
  const duplicar = useDuplicateProposta();
  const deletar = useDeleteProposta();
  const updateProposta = useUpdateProposta();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaFiltro>("todos");
  const [detalhe, setDetalhe] = useState<any>(null);
  const [obs, setObs] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);

  const filtered = useMemo(() => {
    return propostas.filter((p) => {
      const matchBusca =
        p.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
        (p.cliente_empresa?.toLowerCase() || "").includes(busca.toLowerCase());

      if (!matchBusca) return false;

      if (categoriaFiltro === "todos") return true;

      const servicos = (p.proposta_servicos || []) as any[];
      return servicos.some((s) => categorizeServico(s.servico_nome) === categoriaFiltro);
    });
  }, [propostas, busca, categoriaFiltro]);

  const handleDuplicar = async (id: string) => {
    try {
      await duplicar.mutateAsync(id);
      toast({ title: "Proposta duplicada!" });
    } catch {
      toast({ title: "Erro ao duplicar", variant: "destructive" });
    }
  };

  const handleDeletar = async () => {
    if (!deleteTarget) return;
    try {
      await deletar.mutateAsync(deleteTarget.id);
      toast({ title: "Proposta apagada!" });
    } catch {
      toast({ title: "Erro ao apagar", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
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
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-full sm:w-[200px]" />
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Propostas</h1>
          <p className="text-muted-foreground mt-1">
            {filtered.length === propostas.length
              ? `${propostas.length} propostas cadastradas`
              : `${filtered.length} de ${propostas.length} propostas`}
            {categoriaFiltro !== "todos" && ` • ${CATEGORIAS[categoriaFiltro]}`}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou empresa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={categoriaFiltro} onValueChange={(v) => setCategoriaFiltro(v as CategoriaFiltro)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por serviço" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORIAS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Valor</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
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
                      <TableCell className="font-medium">
                        <div>
                          {p.cliente_nome}
                          <div className="sm:hidden text-xs text-muted-foreground">{p.cliente_empresa}</div>
                          <div className="sm:hidden text-xs font-semibold">{formatCurrency(p.valor_total)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{p.cliente_empresa || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[p.status as StatusProposta]}>
                          {STATUS_LABELS[p.status as StatusProposta]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium hidden sm:table-cell">{formatCurrency(p.valor_total)}</TableCell>
                      <TableCell className="hidden md:table-cell">{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        {/* Desktop: all buttons visible */}
                        <div className="hidden sm:flex gap-1 justify-end">
                          {p.cliente_whatsapp && (
                            <a
                              href={formatWhatsAppUrl(p.cliente_whatsapp, p.cliente_nome)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir WhatsApp de ${p.cliente_nome}`}
                            >
                              <Button variant="ghost" size="icon" className="text-green-500 hover:text-green-600 hover:bg-green-50">
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" aria-label="Ver detalhes" onClick={() => { setDetalhe(p); setObs(p.observacoes || ""); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Baixar PDF" onClick={() => handleDownloadPDF(p)}>
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Duplicar proposta" onClick={() => handleDuplicar(p.id)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Apagar proposta"
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-50"
                            onClick={() => setDeleteTarget({ id: p.id, nome: p.cliente_nome })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Mobile: collapsed dropdown */}
                        <div className="sm:hidden">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Mais ações">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {p.cliente_whatsapp && (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={formatWhatsAppUrl(p.cliente_whatsapp, p.cliente_nome)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-green-600"
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                    WhatsApp
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => { setDetalhe(p); setObs(p.observacoes || ""); }}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadPDF(p)}>
                                <FileDown className="h-4 w-4 mr-2" />
                                Baixar PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicar(p.id)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-500"
                                onClick={() => setDeleteTarget({ id: p.id, nome: p.cliente_nome })}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Apagar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detalhes modal */}
      <Dialog open={!!detalhe} onOpenChange={() => setDetalhe(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Proposta</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div><strong>Cliente:</strong> {detalhe.cliente_nome}</div>
                <div><strong>Empresa:</strong> {detalhe.cliente_empresa || "—"}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <strong>WhatsApp:</strong>
                  {detalhe.cliente_whatsapp ? (
                    <a
                      href={formatWhatsAppUrl(detalhe.cliente_whatsapp, detalhe.cliente_nome)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-green-600 hover:text-green-700 font-medium transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {detalhe.cliente_whatsapp}
                    </a>
                  ) : "—"}
                </div>
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
                <Button size="sm" onClick={handleSaveObs} disabled={updateProposta.isPending}>
                  {updateProposta.isPending ? "Salvando..." : "Salvar observações"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de deleção */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar a proposta de <strong>{deleteTarget?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
