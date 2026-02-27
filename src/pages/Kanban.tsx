import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePropostas, useUpdatePropostaStatus, useDeleteProposta } from "@/hooks/usePropostas";
import { useAgendaEvents } from "@/hooks/useGoogleCalendar";
import { useAtividades } from "@/hooks/useAtividades";
import { STATUS_LABELS, type StatusProposta, type PropostaDB } from "@/types/proposta";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useToast } from "@/hooks/use-toast";
import { Trash2, MessageCircle, Calendar, FilePlus, Eye, Search, Link2, Pencil } from "lucide-react";

const COLUMNS: StatusProposta[] = ["novo_lead", "proposta_enviada", "em_negociacao", "fechado", "perdido"];

const COLUMN_STYLES: Record<StatusProposta, { border: string; bg: string; badge: string; dragOver: string }> = {
  novo_lead:         { border: "border-t-[3px] border-t-blue-500",   bg: "bg-blue-50/50",    badge: "bg-blue-100 text-blue-700",   dragOver: "bg-blue-50" },
  proposta_enviada:  { border: "border-t-[3px] border-t-amber-500",  bg: "bg-amber-50/50",   badge: "bg-amber-100 text-amber-700",  dragOver: "bg-amber-50" },
  em_negociacao:     { border: "border-t-[3px] border-t-purple-500", bg: "bg-purple-50/50",  badge: "bg-purple-100 text-purple-700", dragOver: "bg-purple-50" },
  fechado:           { border: "border-t-[3px] border-t-emerald-500", bg: "bg-emerald-50/50", badge: "bg-emerald-100 text-emerald-700", dragOver: "bg-emerald-50" },
  perdido:           { border: "border-t-[3px] border-t-red-500",    bg: "bg-red-50/50",     badge: "bg-red-100 text-red-700",     dragOver: "bg-red-50" },
};

const DELETE_ZONE_ID = "__DELETE__";

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

export default function Kanban() {
  const navigate = useNavigate();
  const { data: propostas = [], isLoading } = usePropostas();
  const { data: agendaEvents = [] } = useAgendaEvents();
  const updateStatus = useUpdatePropostaStatus();
  const deleteProposta = useDeleteProposta();
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProposta, setSelectedProposta] = useState<PropostaDB | null>(null);
  const { data: atividades = [] } = useAtividades(selectedProposta?.id);
  const [deleteTarget, setDeleteTarget] = useState<PropostaDB | null>(null);
  const [busca, setBusca] = useState("");

  const pendingAgendaEvents = agendaEvents.filter((e) => e.status === "pendente");

  const propostasFiltradas = useMemo(() => {
    if (!busca.trim()) return propostas;
    const lower = busca.toLowerCase();
    return propostas.filter(
      (p) =>
        p.cliente_nome.toLowerCase().includes(lower) ||
        (p.cliente_empresa?.toLowerCase() || "").includes(lower),
    );
  }, [propostas, busca]);

  const isPropostaVazia = (p: PropostaDB) => {
    return (!p.proposta_servicos || p.proposta_servicos.length === 0) && p.valor_total === 0;
  };

  const handleCopyLink = (p: PropostaDB) => {
    if (!p.public_token) {
      toast({ title: "Link não disponível para esta proposta" });
      return;
    }
    navigator.clipboard.writeText(`${window.location.origin}/p/${p.public_token}`);
    toast({ title: "Link copiado!" });
  };

  const handleCriarProposta = (p: PropostaDB) => {
    const params = new URLSearchParams({
      cliente: p.cliente_nome,
      empresa: p.cliente_empresa || "",
      whatsapp: p.cliente_whatsapp || "",
      propostaId: p.id,
    });
    navigate(`/nova-proposta?${params.toString()}`);
  };

  const handleDragStart = () => setIsDragging(true);

  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    if (!result.destination) return;

    const destinationId = result.destination.droppableId;
    const propostaId = result.draggableId;

    if (destinationId === DELETE_ZONE_ID) {
      const proposta = propostas.find((p) => p.id === propostaId);
      if (proposta) setDeleteTarget(proposta);
      return;
    }

    const newStatus = destinationId as StatusProposta;
    try {
      await updateStatus.mutateAsync({ id: propostaId, status: newStatus });
    } catch {
      toast({ title: "Erro ao mover proposta", variant: "destructive" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProposta.mutateAsync(deleteTarget.id);
      toast({ title: "Proposta apagada!" });
    } catch {
      toast({ title: "Erro ao apagar", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-32" />
        <div className="flex gap-3 overflow-x-auto pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="min-w-[220px] sm:min-w-[260px] flex-1">
              <Skeleton className="h-[300px] w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Kanban</h1>
          <p className="text-muted-foreground mt-1 text-sm hidden sm:block">Arraste os cards para mover entre etapas</p>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial sm:max-w-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {pendingAgendaEvents.length > 0 && (
            <Link to="/configuracoes">
              <Button variant="outline" size="sm" className="gap-2 relative shrink-0">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Leads da Agenda</span>
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {pendingAgendaEvents.length}
                </span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {busca && (
        <p className="text-sm text-muted-foreground">
          {propostasFiltradas.length} resultado{propostasFiltradas.length !== 1 ? "s" : ""} para <strong>"{busca}"</strong>
        </p>
      )}

      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-20 snap-x snap-mandatory">
          {COLUMNS.map((col) => {
            const items = propostasFiltradas.filter((p) => p.status === col);
            const style = COLUMN_STYLES[col];
            return (
              <div key={col} className="min-w-[220px] sm:min-w-[260px] flex-1 snap-start">
                <div className={`rounded-xl ${style.border} ${style.bg} p-3 shadow-sm`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">{STATUS_LABELS[col]}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                      {items.length}
                    </span>
                  </div>

                  <Droppable droppableId={col}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[200px] space-y-2 transition-colors rounded-lg p-1 ${
                          snapshot.isDraggingOver ? style.dragOver : ""
                        }`}
                      >
                        {items.map((proposta, index) => {
                          const vazia = isPropostaVazia(proposta);
                          return (
                            <Draggable key={proposta.id} draggableId={proposta.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => setSelectedProposta(proposta)}
                                  className={`p-3 cursor-grab active:cursor-grabbing transition-all duration-200 border-0 shadow-sm hover:shadow-md ${
                                    snapshot.isDragging ? "shadow-xl ring-2 ring-primary/20 rotate-1" : ""
                                  } ${vazia ? "border-l-4 border-l-amber-400" : ""}`}
                                >
                                  <div className="flex items-start justify-between">
                                    <p className="font-medium text-sm truncate flex-1 pr-1">{proposta.cliente_nome}</p>
                                    {vazia && (
                                      <Badge variant="outline" className="text-[9px] py-0 bg-amber-50 text-amber-600 border-amber-200 shrink-0">
                                        Sem proposta
                                      </Badge>
                                    )}
                                  </div>
                                  {proposta.cliente_empresa && (
                                    <p className="text-xs text-muted-foreground truncate">{proposta.cliente_empresa}</p>
                                  )}
                                  {!vazia && (
                                    <p className="text-sm font-bold text-foreground mt-1">
                                      {formatCurrency(proposta.valor_total)}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {proposta.proposta_servicos?.map((s) => (
                                      <Badge key={s.id} variant="outline" className="text-[10px] py-0 font-normal">
                                        {s.servico_nome}
                                      </Badge>
                                    ))}
                                  </div>
                                  <div className="flex items-center justify-between mt-1">
                                    <p className="text-[10px] text-muted-foreground">
                                      {new Date(proposta.created_at).toLocaleDateString("pt-BR")}
                                    </p>
                                    {proposta.cliente_whatsapp && (
                                      <a
                                        href={formatWhatsAppUrl(proposta.cliente_whatsapp, proposta.cliente_nome)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`WhatsApp de ${proposta.cliente_nome}`}
                                        className="text-green-500 hover:text-green-600 transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                      >
                                        <MessageCircle className="h-4 w-4" />
                                      </a>
                                    )}
                                  </div>
                                </Card>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            );
          })}
        </div>

        {/* Delete drop zone */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center transition-all duration-300 pointer-events-none ${
            isDragging ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
          }`}
        >
          <Droppable droppableId={DELETE_ZONE_ID}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`pointer-events-auto mb-6 px-10 py-4 rounded-2xl flex items-center gap-3 transition-all duration-200 shadow-2xl ${
                  snapshot.isDraggingOver
                    ? "bg-red-500 text-white scale-110 shadow-red-500/40"
                    : "bg-neutral-900 text-neutral-300 scale-100"
                }`}
              >
                <Trash2 className={`h-5 w-5 transition-transform duration-200 ${snapshot.isDraggingOver ? "scale-125" : ""}`} />
                <span className="font-semibold text-sm">
                  {snapshot.isDraggingOver ? "Solte para apagar" : "Arraste aqui para apagar"}
                </span>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </DragDropContext>

      {/* Modal de detalhes */}
      <Dialog open={!!selectedProposta} onOpenChange={() => setSelectedProposta(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          {selectedProposta && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {selectedProposta.cliente_nome}
                  {isPropostaVazia(selectedProposta) && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                      Lead sem proposta
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {selectedProposta.cliente_empresa && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Empresa:</strong> {selectedProposta.cliente_empresa}
                  </p>
                )}
                {selectedProposta.cliente_whatsapp && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                    <strong>WhatsApp:</strong>{" "}
                    <a
                      href={formatWhatsAppUrl(selectedProposta.cliente_whatsapp, selectedProposta.cliente_nome)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline flex items-center gap-1"
                    >
                      {selectedProposta.cliente_whatsapp}
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </p>
                )}

                {selectedProposta.public_token && (
                  <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => handleCopyLink(selectedProposta)}>
                    <Link2 className="h-3.5 w-3.5" />
                    Copiar link público
                  </Button>
                )}

                {isPropostaVazia(selectedProposta) ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm text-amber-700">
                      Este lead ainda não tem uma proposta definida. Clique abaixo para criar a proposta completa com serviços e valores.
                    </p>
                    <Button onClick={() => handleCriarProposta(selectedProposta)} className="w-full gap-2">
                      <FilePlus className="h-4 w-4" />
                      Criar Proposta
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground">Valor Total</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedProposta.valor_total)}</p>
                    </div>

                    {selectedProposta.proposta_servicos && selectedProposta.proposta_servicos.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Serviços:</p>
                        <div className="space-y-1">
                          {selectedProposta.proposta_servicos.map((s) => (
                            <div key={s.id} className="flex justify-between text-sm">
                              <span>{s.servico_nome}</span>
                              <span className="font-medium">{formatCurrency(s.valor_mensal)}/mês</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="w-full gap-2 mt-2"
                      onClick={() => { navigate(`/nova-proposta?propostaId=${selectedProposta.id}`); setSelectedProposta(null); }}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar Proposta
                    </Button>
                  </div>
                )}

                {selectedProposta.observacoes && (
                  <div>
                    <p className="text-sm font-medium mb-1">Observações:</p>
                    <p className="text-sm text-muted-foreground">{selectedProposta.observacoes}</p>
                  </div>
                )}

                {atividades.length > 0 && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-sm font-medium">Últimas atividades</p>
                    <div className="space-y-1.5">
                      {atividades.slice(0, 3).map((a) => (
                        <div key={a.id} className="text-xs p-2 rounded-lg bg-muted/40 flex gap-2">
                          <span className="font-medium capitalize">{a.tipo}:</span>
                          <span className="text-muted-foreground flex-1">{a.descricao}</span>
                          <span className="text-muted-foreground/60 shrink-0">
                            {new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Link to="/propostas" onClick={() => setSelectedProposta(null)} className="text-xs text-primary hover:underline">
                      Ver todas as atividades →
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de deleção */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar a proposta de <strong>{deleteTarget?.cliente_nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
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
