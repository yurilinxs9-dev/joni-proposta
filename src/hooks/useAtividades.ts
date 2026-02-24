import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { AtividadeDB, AtividadeTipo } from "@/types/proposta";

// ── Fetch atividades de uma proposta ─────────────────────────────────────────
export function useAtividades(propostaId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["atividades", propostaId],
    queryFn: async (): Promise<AtividadeDB[]> => {
      if (!propostaId) return [];
      const { data, error } = await supabase
        .from("proposta_atividades")
        .select("*")
        .eq("proposta_id", propostaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AtividadeDB[];
    },
    enabled: !!user && !!propostaId,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ── Adicionar atividade (usuário autenticado) ─────────────────────────────────
export function useAddAtividade() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      propostaId,
      tipo,
      descricao,
    }: {
      propostaId: string;
      tipo: AtividadeTipo;
      descricao?: string;
    }) => {
      const { error } = await supabase.from("proposta_atividades").insert({
        proposta_id: propostaId,
        tipo,
        descricao: descricao || null,
        criado_por: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["atividades", variables.propostaId] });
    },
  });
}

// ── Registrar visualização pública (sem auth — anon) ──────────────────────────
export async function registrarVisualizacao(token: string, propostaId: string) {
  await Promise.allSettled([
    supabase.from("proposta_views").insert({ token }),
    supabase.from("proposta_atividades").insert({
      proposta_id: propostaId,
      tipo: "visualizacao",
      descricao: "Proposta visualizada pelo cliente via link público",
      criado_por: null,
    }),
  ]);
}

// ── Registrar aceite público (sem auth — anon) ────────────────────────────────
export async function registrarAceite(propostaId: string) {
  await supabase.from("proposta_atividades").insert({
    proposta_id: propostaId,
    tipo: "aceite",
    descricao: "Proposta aceita pelo cliente via link público",
    criado_por: null,
  });
}
