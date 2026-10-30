// IRL-26/IRL-27: the Line/Station filter checklists used to derive their
// options purely from the live SSE buffer (the last ~50 events), so they
// only ever showed whatever happened to stream through recently - not every
// line or stop a system actually has. These fetch the full picture from the
// backend's new GET /lines and GET /stops endpoints.

// Mirrors models.LineSummary in the gtfs-realtime repo - see that model's
// own docstring for why trip_headsign rides alongside the route fields
// rather than this just being a plain route list (BART's Line identity is
// headsign-based, not route-based).
export type LineSummary = {
    route_id: string;
    route_short_name: string | null;
    route_long_name: string | null;
    trip_headsign: string | null;
};

export async function fetchAllLines(systemId: string): Promise<LineSummary[]> {
    const res = await fetch(`/api/lines/${encodeURIComponent(systemId)}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch lines: ${res.status}`);
    }
    return res.json();
}

export async function fetchAllStops(systemId: string): Promise<string[]> {
    const res = await fetch(`/api/stops/${encodeURIComponent(systemId)}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch stops: ${res.status}`);
    }
    return res.json();
}
