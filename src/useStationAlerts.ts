import { useEffect, useRef, useState } from "react";
import type { SavedStation } from "./savedStations.ts";
import type { StreamedUpdate } from "./tripUpdate.ts";

export type StationAlert = {
    key: string;
    stopName: string;
    tripHeadsign: string | null;
    etaMinutes: number;
};

// Phase 4 (.claude/plans/development.md): in-app-only alert delivery for
// this first slice - watches the live SSE stream (already flowing through
// useTripUpdateStream) for a message whose stop_name matches a saved,
// alert-enabled station, and fires once the predicted arrival first drops
// to-or-below that station's own alert_lead_minutes. No new polling or
// backend wiring - the eta is just the existing `next` field (epoch
// seconds, see TripRow.tsx's own use of it) relative to now.
export function useStationAlerts(
    systemId: string,
    messages: StreamedUpdate[],
    saved: SavedStation[],
): { alerts: StationAlert[]; dismiss: (key: string) => void } {
    const [alerts, setAlerts] = useState<StationAlert[]>([]);
    // trip_id:stop_name pairs already alerted on, so a threshold crossed
    // once doesn't re-fire on every subsequent SSE tick for the same trip
    // - reset whenever the system changes, same convention
    // useTripUpdateStream uses for its own per-connection state.
    const firedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        firedRef.current = new Set();
        setAlerts([]);
    }, [systemId]);

    useEffect(() => {
        const enabledByName = new Map(
            saved.filter((s) => s.alert_enabled).map((s) => [s.stop_name, s.alert_lead_minutes]),
        );
        if (enabledByName.size === 0) return;

        const newAlerts: StationAlert[] = [];
        for (const message of messages) {
            const leadMinutes = enabledByName.get(message.stop_name);
            if (leadMinutes === undefined) continue;

            const key = `${message.trip_id}:${message.stop_name}`;
            if (firedRef.current.has(key)) continue;

            const etaMinutes = (message.next * 1000 - Date.now()) / 60000;
            if (etaMinutes > leadMinutes || etaMinutes < 0) continue;

            firedRef.current.add(key);
            newAlerts.push({
                key,
                stopName: message.stop_name,
                tripHeadsign: message.trip_headsign,
                etaMinutes: Math.round(etaMinutes),
            });
        }
        if (newAlerts.length > 0) {
            setAlerts((prev) => [...prev, ...newAlerts]);
        }
    }, [messages, saved]);

    const dismiss = (key: string) => {
        setAlerts((prev) => prev.filter((a) => a.key !== key));
    };

    return { alerts, dismiss };
}
