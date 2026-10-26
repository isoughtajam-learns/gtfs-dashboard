import { Box, Tooltip } from "@mui/material";
import { routeLineLabel } from "./lineLabel.ts";

// GTFS route_color / route_text_color are six hex digits with the '#'
// omitted, so a raw feed value is not a valid CSS color. Falls back to
// theme tokens when absent. (Same helper as EventStreamComponent.tsx/
// TripDetailCard.tsx - duplicated rather than shared since it's a two-line
// pure function.)
const toCssColor = (value: string | null | undefined, fallback: string) => {
    if (!value) return fallback;
    return /^[0-9A-Fa-f]{6}$/.test(value) ? `#${value}` : value;
};

// Mirrors models.IntraSystemTransfer in the gtfs-realtime repo.
export type IntraSystemTransfer = {
    route_id: string;
    route_short_name: string | null;
    route_long_name: string | null;
    color: string | null;
    text_color: string | null;
};

// Intra-system pills/dots are purely informational (no click target - see
// dotSx/dedupeByLine below); inter-system badges still switch systems on
// click, so they alone keep cursor:pointer.
const pillSx = {
    display: "inline-block",
    px: 0.75,
    py: 0.125,
    borderRadius: "6px",
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    fontWeight: 700,
    border: "none",
    whiteSpace: "nowrap" as const,
};

// BART's route short_name is "<Color>-<Direction>" (e.g. "Yellow-N"/
// "Yellow-S") - two distinct route_ids for the same physical line, each
// carrying the same color. A stop that transfers to both directions would
// otherwise render two identical-looking dots side by side, so compact mode
// also collapses entries down to one per base line name (direction suffix
// stripped) - see dedupeByLine below.
const DIRECTION_SUFFIX = /-[NSEW]$/i;
const baseLineName = (transfer: IntraSystemTransfer): string =>
    (transfer.route_short_name ?? transfer.route_id).replace(DIRECTION_SUFFIX, "");

function dedupeByLine(transfers: IntraSystemTransfer[]): IntraSystemTransfer[] {
    const seen = new Map<string, IntraSystemTransfer>();
    for (const transfer of transfers) {
        const key = baseLineName(transfer);
        if (!seen.has(key)) seen.set(key, transfer);
    }
    return Array.from(seen.values());
}

// BART's route short_name is just "<Color>-<Direction>" (e.g. "Yellow-N") -
// the color swatch already is the line identity there, so the text repeats
// what the color says. Other systems' short_names (bus/route numbers etc.)
// aren't redundant with their color the same way, so this only applies to
// BART (see compactIntra callers in EventStreamComponent.tsx/
// TripDetailCard.tsx). The full name is still reachable via the Tooltip on
// hover.
const dotSx = {
    display: "inline-block",
    width: 14,
    height: 14,
    minWidth: 14,
    borderRadius: "50%",
    border: "none",
    padding: 0,
};

// Inter-system badges otherwise show the raw system id verbatim (see
// interSystemLabel below) - short enough for every other active system
// ("BART", "SF-MTA", "Caltrain", "VTA", "AC_Transit", ...), but "Golden_
// Gate_Transit" alone is long enough to wrap the pill awkwardly. Keyed by
// system id so adding another abbreviation later is a one-line change.
const SYSTEM_ABBREVIATIONS: Record<string, string> = {
    Golden_Gate_Transit: "GGT",
};

// The Tooltip still shows the full system id on hover either way - this
// only shortens what's visible inline on the badge itself.
const interSystemLabel = (systemId: string): string =>
    SYSTEM_ABBREVIATIONS[systemId] ?? systemId;

type TransferIndicatorsProps = {
    intraSystemTransfers: IntraSystemTransfer[];
    interSystemTransferSystems: string[];
    // Intra-system pills/dots are informational only, with no click target.
    // Clicking an inter-system badge switches the feed to that system, with
    // no stop/route filter attached - both callers (EventStreamComponent's
    // feed rows, TripDetailCard's stop rows) implement onInterClick as a
    // plain system switch.
    onInterClick: (systemId: string) => void;
    // Render intra-system transfers as plain colored dots instead of
    // labeled pills (see dotSx above). The label still shows in the
    // Tooltip, just not inline.
    compactIntra?: boolean;
};

// Shared between the feed table's Transfers column and TripDetailCard's -
// intra-system pills (own-system route, correctly colored) first, then
// inter-system badges (plain text for now - no real per-agency logo assets
// exist yet; swapping one in later only touches this render, not the data
// flowing into it). Renders nothing when there's nothing to show, so
// callers can place it unconditionally without an extra empty-cell check.
export default function TransferIndicators({
    intraSystemTransfers,
    interSystemTransferSystems,
    onInterClick,
    compactIntra = false,
}: TransferIndicatorsProps) {
    if (intraSystemTransfers.length === 0 && interSystemTransferSystems.length === 0) {
        return null;
    }
    const displayedIntraTransfers = compactIntra ? dedupeByLine(intraSystemTransfers) : intraSystemTransfers;
    return (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
            {displayedIntraTransfers.map((transfer) => {
                const label =
                    routeLineLabel(transfer.route_id, transfer.route_short_name, transfer.route_long_name) ??
                    transfer.route_short_name ??
                    transfer.route_id;
                if (compactIntra) {
                    return (
                        <Tooltip key={transfer.route_id} title={`Transfer to ${baseLineName(transfer)}`}>
                            <Box
                                sx={{
                                    ...dotSx,
                                    backgroundColor: toCssColor(transfer.color, "var(--ink-secondary)"),
                                }}
                            />
                        </Tooltip>
                    );
                }
                return (
                    <Tooltip key={transfer.route_id} title={`Transfer to ${label}`}>
                        <Box
                            sx={{
                                ...pillSx,
                                backgroundColor: `color-mix(in srgb, ${toCssColor(transfer.color, "var(--ink-secondary)")} 70%, var(--surface))`,
                                color: toCssColor(transfer.text_color, "#fff"),
                            }}
                        >
                            { transfer.route_short_name ?? transfer.route_id }
                        </Box>
                    </Tooltip>
                );
            })}
            {interSystemTransferSystems.map((transferSystemId) => (
                <Tooltip key={transferSystemId} title={`Transfer to ${transferSystemId}`}>
                    <Box
                        component="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onInterClick(transferSystemId);
                        }}
                        sx={{
                            ...pillSx,
                            cursor: "pointer",
                            border: "1px solid var(--hairline)",
                            backgroundColor: "var(--surface)",
                            color: "var(--ink)",
                        }}
                    >
                        { interSystemLabel(transferSystemId) }
                    </Box>
                </Tooltip>
            ))}
        </Box>
    );
}
