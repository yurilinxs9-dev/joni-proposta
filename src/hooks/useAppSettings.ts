import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = Record<string, string | null>;

/** Read all settings as a flat key→value object */
export function useAppSettings() {
  return useQuery<AppSettings>({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value");
      if (error) throw error;
      return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    },
    staleTime: 60_000, // re-fetch at most once per minute
  });
}

/** Upsert a single setting by key */
export function useSaveSetting() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings"] }),
  });
}
