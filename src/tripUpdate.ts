import type { IntraSystemTransfer } from "./TransferIndicators.tsx";
import { routeLineLabel } from "./lineLabel.ts";

export type TripUpdate = {
    trip_id: string;
    trip_headsign: string | null;
    stop_id: string;
    stop_name: string;
    previous: number;
    next: number;
    status: string;
    vehicle: string;
    color?: string | null;
    text_color?: string | null;
    // Absent/null for a real fraction of trips whose route doesn't resolve
    // in schedule data, regardless of system - see lineLabel below.
    route_id?: string | null;
    route_short_name?: string | null;
    route_long_name?: string | null;
    // Phase 3 transfers (see .claude/plans/development.md) - see
    // TransferIndicators.tsx for how these render.
    intra_system_transfers?: IntraSystemTransfer[];
    inter_system_transfer_systems?: string[];
};

// Mirrors models.OperatingHoursStatus in the gtfs-realtime repo - payload
// for transit_feed()'s `operating_hours` SSE event (see
// useTripUpdateStream.ts). Emitted once per connection and whenever the
// status changes, not on every poll.
export type OperatingHoursStatus = {
    outside_operating_hours: boolean;
    next_service_starts_at: string | null;
};

// `seq` is client-assigned at insert/update time, since nothing in the raw
// payload is otherwise guaranteed unique - it doubles as the row's React key,
// so bumping it on every update (not just on first insert) re-triggers the
// row's mount animation even when the row itself isn't moving.
export type StreamedUpdate = TripUpdate & { seq: number };

// Structural, not StreamedUpdate-specific: also matches LineSummary (see
// filterOptions.ts) field-for-field, so the exact same formatting runs
// against both a live message and a fetched "all lines" row in the filter
// checklist.
export type LineFields = {
    route_id?: string | null;
    route_short_name?: string | null;
    route_long_name?: string | null;
    trip_headsign: string | null;
};

// Line column's own fallback (trip_headsign) for whenever routeLineLabel
// returns null - shared between the live feed and the filter checklist, and
// distinct from TripDetailCard's own fallback for the same shared helper
// (see lineLabel.ts's own comment on why that differs per call site).
export const lineLabel = (message: LineFields): string | null =>
    routeLineLabel(message.route_id, message.route_short_name, message.route_long_name) ?? message.trip_headsign;

// GTFS trip_headsign is nullable; group those rows under one filterable
// bucket rather than dropping them.
export const NO_LINE = "(No line)";
export const lineFilterValue = (message: LineFields) => lineLabel(message) ?? NO_LINE;

// GTFS route_color / route_text_color are six hex digits with the '#' omitted, so a
// raw feed value is not a valid CSS color. Falls back to theme tokens when absent.
export const toCssColor = (value: string | null | undefined, fallback: string) => {
    if (!value) return fallback;
    return /^[0-9A-Fa-f]{6}$/.test(value) ? `#${value}` : value;
};
