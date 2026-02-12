import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ServicoPersonalizado {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  valor_mensal: number;
  valor_setup: number;
  tem_setup: boolean;
  oculto: boolean;
  created_at: string;
  updated_at: string;
}

export function useServicosPersonalizados() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["servicos_personalizados", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("servicos_personalizados")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ServicoPersonalizado[];
    },
    enabled: !!user,
  });
}

export function useCreateServico() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (servico: {
      nome: string;
      descricao?: string;
      valor_mensal: number;
      valor_setup: number;
      tem_setup: boolean;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase
        .from("servicos_personalizados")
        .insert({
          user_id: user.id,
          nome: servico.nome,
          descricao: servico.descricao || "",
          valor_mensal: servico.valor_mensal,
          valor_setup: servico.valor_setup,
          tem_setup: servico.tem_setup,
          oculto: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servicos_personalizados"] }),
  });
}

export function useUpdateServico() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      nome?: string;
      descricao?: string;
      valor_mensal?: number;
      valor_setup?: number;
      tem_setup?: boolean;
      oculto?: boolean;
    }) => {
      const { error } = await supabase
        .from("servicos_personalizados")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servicos_personalizados"] }),
  });
}

export function useDeleteServico() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("servicos_personalizados")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servicos_personalizados"] }),
  });
}

export function useToggleOculto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, oculto }: { id: string; oculto: boolean }) => {
      const { error } = await supabase
        .from("servicos_personalizados")
        .update({ oculto })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servicos_personalizados"] }),
  });
}
