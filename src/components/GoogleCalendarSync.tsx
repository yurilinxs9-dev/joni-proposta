import { useEffect, useRef } from "react";
import { useGoogleIntegration, useSyncGoogleCalendar } from "@/hooks/useGoogleCalendar";

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos

export function GoogleCalendarSync() {
  const { data: integration } = useGoogleIntegration();
  const syncCalendar = useSyncGoogleCalendar();
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!integration?.enabled || !integration?.access_token) return;

    // Função de sincronização
    const doSync = () => {
      const now = Date.now();
      // Evitar sincronizações muito próximas
      if (now - lastSyncRef.current < SYNC_INTERVAL - 10000) return;

      lastSyncRef.current = now;
      syncCalendar.mutate(integration.access_token, {
        onError: (error) => {
          console.error("Erro na sincronização automática:", error);
        },
      });
    };

    // Sincronizar imediatamente se última sincronização foi há mais de 5 minutos
    if (integration.last_sync) {
      const lastSync = new Date(integration.last_sync).getTime();
      const timeSinceLastSync = Date.now() - lastSync;
      if (timeSinceLastSync > SYNC_INTERVAL) {
        doSync();
      }
    } else {
      // Nunca sincronizou, fazer agora
      doSync();
    }

    // Configurar intervalo
    const interval = setInterval(doSync, SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [integration?.enabled, integration?.access_token, integration?.last_sync]);

  // Componente invisível
  return null;
}
