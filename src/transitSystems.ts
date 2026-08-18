// `id` is the path segment the backend expects at /api/trip_updates/{id};
// `label` is what the dropdown shows.
export type TransitSystem = {
    id: string;
    label: string;
};

// Feed ids are already `Word_Word` per GTFS convention (or a bare acronym
// like "BART"), so swapping underscores for spaces is enough to get a
// readable label — no case transformation needed.
function toLabel(id: string): string {
    return id.replace(/_/g, " ");
}

export async function fetchTransitSystems(): Promise<TransitSystem[]> {
    const res = await fetch("/api/transit_systems");
    if (!res.ok) {
        throw new Error(`Failed to fetch transit systems: ${res.status}`);
    }
    const ids: string[] = await res.json();
    return ids.map((id) => ({ id, label: toLabel(id) }));
}
