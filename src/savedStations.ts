// Phase 4 (.claude/plans/development.md): typed fetch helpers for the
// backend's /saved_stations* endpoints. Mirrors models.SavedStationOut in
// gtfs-realtime - keyed by stop_name, not stop_id (see that model's own
// docstring for why).

export type SavedStation = {
    stop_name: string;
    alert_enabled: boolean;
    alert_lead_minutes: number;
    transit_system?: string | null;
};

export class SavedStationsError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

// FastAPI's own 404/409 handlers in main.py send detail as a plain
// string, but a Pydantic validation failure (422 - e.g. an
// alert_lead_minutes outside SavedStationUpdate's ge=1/le=60 range)
// sends it as an array of {loc, msg, type} objects instead -
// String(detail) on that shape renders as an unhelpful "[object Object]".
function extractErrorDetail(body: unknown, fallback: string): string {
    if (!body || typeof body !== "object" || !("detail" in body)) return fallback;
    const detail = (body as { detail: unknown }).detail;
    if (Array.isArray(detail)) {
        const messages = detail
            .map((item) =>
                item && typeof item === "object" && "msg" in item
                    ? String((item as { msg: unknown }).msg)
                    : null,
            )
            .filter((msg): msg is string => msg !== null);
        return messages.length > 0 ? messages.join("; ") : fallback;
    }
    return String(detail);
}

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
    return parse<SavedStation[]>(res);
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
