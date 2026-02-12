import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PropostaDB, StatusProposta } from "@/types/proposta";

export function usePropostas() {
  return useQuery({
    queryKey: ["propostas"],
    queryFn: async (): Promise<PropostaDB[]> => {
      const { data, error } = await supabase
        .from("propostas")
        .select("*, proposta_servicos(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });
}

export function useProposta(id: string | undefined) {
  return useQuery({
    queryKey: ["proposta", id],
    queryFn: async (): Promise<PropostaDB> => {
      const { data, error } = await supabase
        .from("propostas")
        .select("*, proposta_servicos(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });
}

export function useCreateProposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposta: {
      cliente_nome: string;
      cliente_empresa?: string;
      cliente_whatsapp?: string;
      cliente_email?: string;
      valor_mensal: number;
      valor_setup: number;
      valor_total: number;
      desconto_tipo?: string;
      desconto_valor?: number;
      observacoes?: string;
      criado_por?: string;
      servicos: { servico_nome: string; descricao: string; valor_mensal: number; valor_setup: number }[];
    }) => {
      const { servicos, ...propostaData } = proposta;
      const { data, error } = await supabase
        .from("propostas")
        .insert(propostaData)
        .select()
        .single();
      if (error) throw error;

      if (servicos.length > 0) {
        const { error: sError } = await supabase
          .from("proposta_servicos")
          .insert(servicos.map((s) => ({ ...s, proposta_id: data.id })));
        if (sError) throw sError;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["propostas"] }),
  });
}

export function useUpdatePropostaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusProposta }) => {
      const { error } = await supabase.from("propostas").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["propostas"] }),
  });
}

export function useUpdateProposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; observacoes?: string; status?: StatusProposta }) => {
      const { error } = await supabase.from("propostas").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["propostas"] }),
  });
}

// Atualiza proposta completa (dados + serviços) - usado quando completamos um lead
export function useUpdatePropostaCompleta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposta: {
      id: string;
      cliente_nome: string;
      cliente_empresa?: string;
      cliente_whatsapp?: string;
      cliente_email?: string;
      valor_mensal: number;
      valor_setup: number;
      valor_total: number;
      desconto_tipo?: string;
      desconto_valor?: number;
      observacoes?: string;
      servicos: { servico_nome: string; descricao: string; valor_mensal: number; valor_setup: number }[];
    }) => {
      const { id, servicos, ...propostaData } = proposta;

      // Atualiza proposta
      const { error } = await supabase
        .from("propostas")
        .update(propostaData)
        .eq("id", id);
      if (error) throw error;

      // Remove serviços antigos e insere novos
      const { error: deleteError } = await supabase
        .from("proposta_servicos")
        .delete()
        .eq("proposta_id", id);
      if (deleteError) throw deleteError;

      if (servicos.length > 0) {
        const { error: sError } = await supabase
          .from("proposta_servicos")
          .insert(servicos.map((s) => ({ ...s, proposta_id: id })));
        if (sError) throw sError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["propostas"] }),
  });
}

export function useDeleteProposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("propostas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["propostas"] }),
  });
}

export function useDuplicateProposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: original, error: fetchError } = await supabase
        .from("propostas")
        .select("*, proposta_servicos(*)")
        .eq("id", id)
        .single();
      if (fetchError) throw fetchError;

      const { id: _id, created_at, updated_at, proposta_servicos, ...rest } = original as any;
      const { data: newProposta, error } = await supabase
        .from("propostas")
        .insert({ ...rest, status: "novo_lead", cliente_nome: `${rest.cliente_nome} (cópia)` })
        .select()
        .single();
      if (error) throw error;

      if (proposta_servicos?.length > 0) {
        const { error: sError } = await supabase
          .from("proposta_servicos")
          .insert(proposta_servicos.map((s: any) => ({
            proposta_id: newProposta.id,
            servico_nome: s.servico_nome,
            descricao: s.descricao,
            valor_mensal: s.valor_mensal,
            valor_setup: s.valor_setup,
          })));
        if (sError) throw sError;
      }
      return newProposta;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["propostas"] }),
  });
}
