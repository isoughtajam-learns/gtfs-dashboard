// Phase 4 (.claude/plans/development.md): typed fetch helpers for the
// backend's /saved_stations* endpoints. Mirrors models.SavedStationOut in
// gtfs-realtime - keyed by stop_name, not stop_id (see that model's own
// docstring for why).

import { HttpError, extractErrorDetail } from "./httpError.ts";

export type SavedStation = {
    stop_name: string;
    alert_enabled: boolean;
    alert_lead_minutes: number;
    transit_system?: string | null;
};

export class SavedStationsError extends HttpError {}

async function parse<T>(res: Response, emptyOn404 = false): Promise<T> {
    if (!res.ok) {
        if (emptyOn404 && res.status === 404) return [] as unknown as T;
        const body: unknown = await res.json().catch(() => null);
        throw new SavedStationsError(
            extractErrorDetail(body, `Request failed: ${res.status}`),
            res.status,
        );
    }
    return (await res.json()) as T;
}

export async function fetchSavedStations(systemId: string): Promise<SavedStation[]> {
    const res = await fetch(`/api/saved_stations/${encodeURIComponent(systemId)}`, {
        credentials: "include",
    });
    if (res.status === 401) return [];
    // The backend 404s this path for a transit_system it doesn't
    // recognize (e.g. one renamed/removed server-side since this client
    // last loaded its systems list) - resolving to [] rather than
    // throwing lets useSavedStations's caller correctly clear `saved` for
    // that system instead of silently keeping whatever it last held.
    return parse<SavedStation[]>(res, true);
}

export async function fetchAllSavedStations(): Promise<SavedStation[]> {
    const res = await fetch("/api/saved_stations", { credentials: "include" });
    if (res.status === 401) return [];
    return parse<SavedStation[]>(res);
}

export async function saveStation(
    systemId: string,
    stopName: string,
    alertEnabled = true,
    alertLeadMinutes = 5,
): Promise<SavedStation> {
    const res = await fetch(`/api/saved_stations/${encodeURIComponent(systemId)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            stop_name: stopName,
            alert_enabled: alertEnabled,
            alert_lead_minutes: alertLeadMinutes,
        }),
    });
    return parse<SavedStation>(res);
}

export async function updateSavedStation(
    systemId: string,
    stopName: string,
    patch: { alert_enabled?: boolean; alert_lead_minutes?: number },
): Promise<SavedStation> {
    const res = await fetch(
        `/api/saved_stations/${encodeURIComponent(systemId)}?stop_name=${encodeURIComponent(stopName)}`,
        {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        },
    );
    return parse<SavedStation>(res);
}

export async function unsaveStation(systemId: string, stopName: string): Promise<void> {
    const res = await fetch(
        `/api/saved_stations/${encodeURIComponent(systemId)}?stop_name=${encodeURIComponent(stopName)}`,
        { method: "DELETE", credentials: "include" },
    );
    if (!res.ok && res.status !== 404) {
        throw new SavedStationsError(`Failed to remove saved station: ${res.status}`, res.status);
    }
}
