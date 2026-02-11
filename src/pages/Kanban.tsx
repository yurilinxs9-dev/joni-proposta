import { useState } from "react";
import { usePropostas, useUpdatePropostaStatus, useDeleteProposta } from "@/hooks/usePropostas";
import { STATUS_LABELS, type StatusProposta } from "@/types/proposta";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

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

export default function Kanban() {
  const { data: propostas = [], isLoading } = usePropostas();
  const updateStatus = useUpdatePropostaStatus();
  const deleteProposta = useDeleteProposta();
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);

    if (!result.destination) return;

    const destinationId = result.destination.droppableId;
    const propostaId = result.draggableId;

    // Drop on delete zone
    if (destinationId === DELETE_ZONE_ID) {
      const proposta = propostas.find((p) => p.id === propostaId);
      if (proposta && window.confirm(`Apagar a proposta de "${proposta.cliente_nome}"?`)) {
        try {
          await deleteProposta.mutateAsync(propostaId);
          toast({ title: "Proposta apagada!" });
        } catch {
          toast({ title: "Erro ao apagar", variant: "destructive" });
        }
      }
      return;
    }

    // Drop on status column
    const newStatus = destinationId as StatusProposta;
    try {
      await updateStatus.mutateAsync({ id: propostaId, status: newStatus });
    } catch {
      toast({ title: "Erro ao mover proposta", variant: "destructive" });
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
    <div className="space-y-8 relative">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Kanban</h1>
        <p className="text-muted-foreground mt-1">Arraste os cards para mover entre etapas</p>
      </div>

      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-20">
          {COLUMNS.map((col) => {
            const items = propostas.filter((p) => p.status === col);
            const style = COLUMN_STYLES[col];
            return (
              <div key={col} className="min-w-[260px] flex-1">
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
                        {items.map((proposta, index) => (
                          <Draggable key={proposta.id} draggableId={proposta.id} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 cursor-grab active:cursor-grabbing transition-all duration-200 border-0 shadow-sm hover:shadow-md ${
                                  snapshot.isDragging ? "shadow-xl ring-2 ring-primary/20 rotate-1" : ""
                                }`}
                              >
                                <p className="font-medium text-sm">{proposta.cliente_nome}</p>
                                {proposta.cliente_empresa && (
                                  <p className="text-xs text-muted-foreground">{proposta.cliente_empresa}</p>
                                )}
                                <p className="text-sm font-bold text-foreground mt-1">
                                  {formatCurrency(proposta.valor_total)}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {proposta.proposta_servicos?.map((s) => (
                                    <Badge key={s.id} variant="outline" className="text-[10px] py-0 font-normal">
                                      {s.servico_nome}
                                    </Badge>
                                  ))}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {new Date(proposta.created_at).toLocaleDateString("pt-BR")}
                                </p>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Delete drop zone — appears when dragging ─── */}
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
    </div>
  );
}
