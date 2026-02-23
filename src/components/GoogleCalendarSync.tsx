import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGoogleIntegration, useSyncGoogleCalendar } from "@/hooks/useGoogleCalendar";

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Invisible background component that auto-syncs Google Calendar every 5 minutes.
 * Token refresh is handled server-side in the edge function — no action needed here.
 */
export function GoogleCalendarSync() {
  const { data: integration } = useGoogleIntegration();
  const syncCalendar = useSyncGoogleCalendar();
  const qc = useQueryClient();
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!integration?.enabled) return;

    const doSync = () => {
      const now = Date.now();
      if (now - lastSyncRef.current < SYNC_INTERVAL - 10_000) return;
      lastSyncRef.current = now;

      syncCalendar.mutate(undefined, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["agenda_events"] });
          qc.invalidateQueries({ queryKey: ["google_integration"] });
        },
        onError: (error: Error) => {
          if (error.message === "TOKEN_EXPIRED") {
            // Let the integration query refresh to show "needsReconnect" state in UI
            qc.invalidateQueries({ queryKey: ["google_integration"] });
          } else {
            console.error("[GoogleCalendarSync] Auto-sync error:", error.message);
          }
        },
      });
    };

    // Sync immediately if last sync was more than 5 minutes ago (or never)
    const lastSync = integration.last_sync ? new Date(integration.last_sync).getTime() : 0;
    if (Date.now() - lastSync > SYNC_INTERVAL) {
      doSync();
    }

    const interval = setInterval(doSync, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [integration?.enabled, integration?.last_sync]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
