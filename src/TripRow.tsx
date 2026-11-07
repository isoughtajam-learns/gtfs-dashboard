import type { ReactElement } from "react";
import { Box, TableCell, TableRow, Tooltip } from "@mui/material";
import { keyframes } from "@emotion/react";
import TransferIndicators from "./TransferIndicators.tsx";
import { hasTransfers } from "./transferUtils.ts";
import { lineLabel, toCssColor } from "./tripUpdate.ts";
import type { StreamedUpdate } from "./tripUpdate.ts";

const HEADSIGN_MUTE = 0.7;

const bodyCellSx = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9rem",
    color: "var(--ink)",
    borderColor: "var(--hairline)",
    minWidth: 'auto',
    // Belt-and-suspenders alongside the headsign chip's own maxWidth/ellipsis:
    // some browsers resolve a percentage-based maxWidth on a descendant
    // inconsistently inside a table-layout:fixed cell, so the cell itself
    // also clips rather than relying solely on the child computing it right.
    overflow: 'hidden',
};

// Departure-board flip: each newly-arrived row rotates in around its top
// edge, like a Solari split-flap panel dropping into place. Triggered purely
// by CSS-on-mount (no JS diffing of "changed" fields) — the row list is a
// rolling log where every SSE event is inherently a brand-new row (see
// StreamedUpdate's own seq comment), so "only changed rows animate" here
// means "only the row that just arrived animates": existing rows keep their
// DOM node (same `key`, assigned by the caller's map) as they shift
// position, so this animation never re-fires for them.
const flapIn = keyframes`
    from { transform: rotateX(-90deg); opacity: 0; }
    to { transform: rotateX(0deg); opacity: 1; }
`;

// Shared between the table (sm+) and card (xs) layouts below so the two
// views can't visually drift apart - returns just the cell's inner content,
// the caller wraps it in a <TableCell> or a plain <Box>.
function HeadsignChip({ message }: { message: StreamedUpdate }) {
    const label = lineLabel(message);
    if (label == null) return null;
    return (
        <Tooltip title={label}>
            <Box
                component="span"
                sx={{
                    display: "inline-block",
                    px: 1,
                    py: 0.25,
                    borderRadius: "6px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    backgroundColor: `color-mix(in srgb, ${toCssColor(message.color, "var(--coral)")} ${HEADSIGN_MUTE * 100}%, var(--surface))`,
                    color: toCssColor(message.text_color, "#fff"),
                    maxWidth: "100%",
                }}
            >
                { label }
            </Box>
        </Tooltip>
    );
}

// message.status is e.g. "In Transit 💨" / "Stopped 🛑" - the emoji is
// always the trailing space-separated token, straight from the backend's
// Status enum (src/models.py).
const statusEmoji = (status: string) => status.split(" ").pop() ?? status;
const isInTransit = (status: string) => status.startsWith("In Transit");

// Compact mode (small screens) is emoji-only, so a moving vehicle needs its
// own motion cue in place of the word "In Transit" - a once-a-second fade
// reads as "still moving" without being as attention-grabbing as the
// TripDetailCard's accent-color blink (that one flags "look at this now";
// this one is just ambient status).
const fadePulse = keyframes`
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
`;

function StatusPill({ message, compact = false }: { message: StreamedUpdate; compact?: boolean }) {
    // Neutral treatment: "Stopped"/"In Transit" is a motion state, not
    // schedule adherence, so both statuses use the same coloring rather
    // than implying one is "bad".
    const animate = compact && isInTransit(message.status);
    const pill = (
        <Box
            component="span"
            sx={{
                display: "inline-block",
                px: compact ? 0.75 : 1,
                py: compact ? 0.25 : 0.375,
                borderRadius: "20px",
                backgroundColor: "color-mix(in srgb, var(--ink-secondary) 20%, transparent)",
                color: "var(--ink-secondary)",
                whiteSpace: "nowrap",
                flexShrink: 0,
                animation: animate ? `${fadePulse} 1s ease-in-out infinite` : "none",
                "@media (prefers-reduced-motion: reduce)": {
                    animation: "none",
                },
            }}
        >
            { compact ? statusEmoji(message.status) : message.status }
        </Box>
    );
    // Compact mode drops the text label, so the tooltip is the only way to
    // recover it (besides opening the trip detail card).
    return compact ? <Tooltip title={message.status}>{pill}</Tooltip> : pill;
}

function NextTimeTooltip({ message, children }: { message: StreamedUpdate; children: ReactElement }) {
    const label = message.status == "Stopped"
        ? "Previous Arrival: " + new Date(message.previous * 1000).toLocaleTimeString()
        : "Previous Departure: " + new Date(message.previous * 1000).toLocaleTimeString();
    return <Tooltip title={label}>{children}</Tooltip>;
}

type RowProps = {
    message: StreamedUpdate;
    compactIntra: boolean;
    onSelect: () => void;
    onSystemChange: (systemId: string) => void;
};

// The desktop (sm+) table row - see TripCard below for the xs stacked-card
// equivalent shown in its place. Caller supplies the `key` (message.seq).
export function TripTableRow({ message, compactIntra, onSelect, onSystemChange }: RowProps) {
    return (
        <TableRow
            onClick={onSelect}
            sx={{
                animation: `${flapIn} 180ms ease-out`,
                transformOrigin: "top",
                cursor: "pointer",
                // No zebra striping - row borders only.
                '&:hover': { backgroundColor: "var(--surface-raised)" },
                '&:last-child td, &:last-child th': { border: 0 },
            }}
        >
            <TableCell component="th" scope="row" sx={bodyCellSx}>
                <HeadsignChip message={message} />
            </TableCell>
            <TableCell sx={bodyCellSx}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Box component="span">{ message.stop_name }</Box>
                    {/* Capped width + flexShrink:0 so a stop with several
                        transfers wraps onto a couple of stacked rows here
                        instead of stretching the whole Station column wide
                        enough to fit them side by side; justifyContent:
                        space-between on the row above pins this group to
                        the column's right edge rather than hugging the
                        name. */}
                    <Box sx={{ maxWidth: 150, flexShrink: 0 }}>
                        <TransferIndicators
                            intraSystemTransfers={message.intra_system_transfers ?? []}
                            interSystemTransferSystems={message.inter_system_transfer_systems ?? []}
                            onInterClick={onSystemChange}
                            compactIntra={compactIntra}
                        />
                    </Box>
                </Box>
            </TableCell>
            <TableCell align="center" sx={bodyCellSx}>
                <StatusPill message={message} />
            </TableCell>
            <NextTimeTooltip message={message}>
                <TableCell align="right" sx={[bodyCellSx, { letterSpacing: "0.05em" }]}>
                    { new Date(message.next * 1000).toLocaleTimeString() }
                </TableCell>
            </NextTimeTooltip>
        </TableRow>
    );
}

// The xs stacked-card equivalent of TripTableRow above. Caller supplies the
// `key` (message.seq).
export function TripCard({ message, compactIntra, onSelect, onSystemChange }: RowProps) {
    const rowHasTransfers = hasTransfers(message.intra_system_transfers, message.inter_system_transfer_systems);
    return (
        <Box
            onClick={onSelect}
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
                px: 2,
                py: 1.5,
                borderBottom: "1px solid var(--hairline)",
                cursor: "pointer",
                animation: `${flapIn} 180ms ease-out`,
                transformOrigin: "top",
                fontFamily: "var(--font-mono)",
                '&:hover': { backgroundColor: "var(--surface-raised)" },
                '&:last-of-type': { borderBottom: 0 },
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {/* minWidth:0 alone isn't enough here: a flex item's
                    automatic minimum size only drops to 0 (letting it
                    shrink below its nowrap-text content's full width)
                    when the item's own overflow isn't the visible
                    default - without this the chip could still push
                    past the status pill instead of truncating first. */}
                {/* textAlign:'left' is load-bearing, not decorative: this
                    Box otherwise inherits index.css's #root { text-align:
                    center }, and once the chip is shorter than the space
                    flex-grow gives it, that leftover space would center it
                    instead of pinning it to the left edge. */}
                <Box sx={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textAlign: "left" }}>
                    <HeadsignChip message={message} />
                </Box>
                <StatusPill message={message} compact />
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
                {/* textAlign:'left' is load-bearing here too (see the
                    headsign chip's wrapper above) - without it, a station
                    name long enough to wrap onto a second line inherits
                    index.css's #root { text-align: center } and that
                    second line renders indented instead of flush left. */}
                <Box sx={{ minWidth: 0, flex: "1 1 auto", textAlign: "left" }}>
                    <Box component="span" sx={{ fontSize: "0.95rem", color: "var(--ink)" }}>
                        { message.stop_name }
                    </Box>
                </Box>
                <NextTimeTooltip message={message}>
                    <Box component="span" sx={{ fontSize: "0.95rem", letterSpacing: "0.05em", color: "var(--ink)", flexShrink: 0 }}>
                        { new Date(message.next * 1000).toLocaleTimeString() }
                    </Box>
                </NextTimeTooltip>
            </Box>
            {/* Third row, own-line and left-justified - transfers used
                to be squeezed into the station row above (maxWidth: 80)
                which cramped multi-transfer stops; a dedicated row gives
                them the full card width instead. Only rendered when
                there's something to show, so a stop with no transfers
                doesn't pick up an empty row's gap spacing. */}
            {rowHasTransfers && (
                <Box sx={{ textAlign: "left" }}>
                    <TransferIndicators
                        intraSystemTransfers={message.intra_system_transfers ?? []}
                        interSystemTransferSystems={message.inter_system_transfer_systems ?? []}
                        onInterClick={onSystemChange}
                        compactIntra={compactIntra}
                    />
                </Box>
            )}
        </Box>
    );
}
