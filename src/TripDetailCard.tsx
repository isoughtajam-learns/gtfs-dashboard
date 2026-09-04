import { useEffect, useMemo, useState } from 'react';
import { Box, Dialog, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { keyframes } from "@emotion/react";

// GTFS route_color / route_text_color are six hex digits with the '#' omitted, so a
// raw feed value is not a valid CSS color. Falls back to theme tokens when absent.
// (Same helper as EventStreamComponent.tsx's headsign chip - duplicated rather than
// shared since it's a two-line pure function.)
const toCssColor = (value: string | null | undefined, fallback: string) => {
    if (!value) return fallback;
    return /^[0-9A-Fa-f]{6}$/.test(value) ? `#${value}` : value;
};

const formatEpochSeconds = (value: number | null) =>
    value != null ? new Date(value * 1000).toLocaleTimeString() : "—";

// Delay is negative when the vehicle is ahead of schedule (see the "-" sign
// this preserves rather than only formatting the magnitude).
const formatDelay = (seconds: number | null) => {
    if (seconds == null || seconds === 0) return "—";
    const sign = seconds < 0 ? "-" : "";
    const totalSeconds = Math.abs(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    if (minutes === 0) return `${sign}${remainingSeconds} sec`;
    const minutePart = `${minutes} min`;
    return remainingSeconds === 0 ? `${sign}${minutePart}` : `${sign}${minutePart}, ${remainingSeconds} sec`;
};

// Mirrors GET /trip_detail/{transit_system}/{trip_id}'s response shape
// (src/models.py TripDetail/TripStopDetail in the gtfs-realtime repo).
type TripStopDetail = {
    stop_sequence: number | null;
    stop_id: string;
    stop_name: string | null;
    stop_lat: number | null;
    stop_lon: number | null;
    platform_code: string | null;
    platform_name: string | null;
    wheelchair_boarding: number | null;
    arrival_time: number | null;
    arrival_delay: number | null;
    departure_time: number | null;
    departure_delay: number | null;
    schedule_relationship: string;
};

type TripDetail = {
    trip_id: string;
    route_id: string | null;
    direction_id: number | null;
    trip_headsign: string | null;
    trip_short_name: string | null;
    wheelchair_accessible: number | null;
    bikes_allowed: number | null;
    start_time: string | null;
    start_date: string | null;
    schedule_relationship: string | null;
    delay: number | null;
    timestamp: number | null;
    vehicle_id: string | null;
    vehicle_label: string | null;
    route_short_name: string | null;
    route_long_name: string | null;
    route_url: string | null;
    route_color: string | null;
    route_text_color: string | null;
    route_type: number | null;
    stops: TripStopDetail[];
};

const stopFieldLabelSx = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.7rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    fontWeight: 600,
    color: "var(--ink-secondary)",
};
const stopFieldValueSx = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.95rem",
    color: "var(--ink)",
};

const stopHeadCellSx = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    fontWeight: 600,
    color: "var(--ink-secondary)",
    borderColor: "var(--hairline)",
    whiteSpace: "nowrap" as const,
};
// Zebra striping for legibility across a long stop list. A color-mix off
// --surface (rather than a fixed color) so it stays visible in both themes
// without needing separate light/dark values - --surface and --surface-raised
// are identical in light mode, so reusing either of those wouldn't alternate.
const stopStripeSx = { backgroundColor: "color-mix(in srgb, var(--ink) 4%, var(--surface))" };

const stopBodyCellSx = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    color: "var(--ink)",
    borderColor: "var(--hairline)",
    whiteSpace: "nowrap" as const,
};

// Attention cue for the next stop's name/arrival: pulses the text color
// through the accent rather than fading opacity, so it reads clearly
// against either theme's background.
const blink = keyframes`
    0%, 100% { color: var(--ink); }
    50% { color: var(--coral); }
`;
const blinkSx = {
    fontWeight: 700,
    animation: `${blink} 1.8s ease-in-out infinite`,
    "@media (prefers-reduced-motion: reduce)": {
        animation: "none",
        color: "var(--coral)",
    },
};

function CloseIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

type TripDetailCardProps = {
    systemId: string;
    tripId: string | null;
    onClose: () => void;
};

// Filling most of the screen (not the whole viewport) is deliberate: the
// live table stays visible (dimmed, via the Dialog's own backdrop) around
// the edges, so the streamed feed this card was opened from is still there.
export default function TripDetailCard({ systemId, tripId, onClose }: TripDetailCardProps) {
    const [detail, setDetail] = useState<TripDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!tripId) return;

        let cancelled = false;
        setLoading(true);
        setError(null);
        setDetail(null);

        fetch(`/api/trip_detail/${systemId}/${encodeURIComponent(tripId)}`)
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to fetch trip detail: ${res.status}`);
                return res.json();
            })
            .then((json: TripDetail) => { if (!cancelled) setDetail(json); })
            .catch((err: Error) => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [systemId, tripId]);

    // "Up next" = the first stop this trip hasn't reached yet - its arrival
    // is unknown (still upcoming) or is timestamped in the future.
    const nextStopIndex = useMemo(() => {
        if (!detail) return -1;
        const nowSeconds = Date.now() / 1000;
        return detail.stops.findIndex(
            (stop) => stop.arrival_time == null || stop.arrival_time >= nowSeconds
        );
    }, [detail]);

    return (
        <Dialog
            open={tripId != null}
            onClose={onClose}
            maxWidth={false}
            slotProps={{
                paper: {
                    sx: {
                        width: "88vw",
                        height: "88vh",
                        maxWidth: "88vw",
                        maxHeight: "88vh",
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        backgroundColor: "var(--surface-raised)",
                        border: "1px solid var(--hairline)",
                        borderRadius: "var(--radius)",
                        color: "var(--ink)",
                        boxShadow: "none",
                    },
                },
            }}
        >
            <Box
                sx={{
                    position: "relative",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    // Room for the close button, pinned absolutely on xs so
                    // it never gets swept into the title/badge's own wrap
                    // flow (see the IconButton's sx below).
                    pr: { xs: 6, sm: 2 },
                    borderBottom: "1px solid var(--hairline)",
                    flexShrink: 0,
                }}
            >
                <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", textAlign: "left", minWidth: 0 }}>
                    { detail?.trip_headsign ?? `Trip ${tripId}` }
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0, maxWidth: "100%" }}>
                    { detail?.route_long_name && (
                        <Tooltip title={detail.route_long_name}>
                            <Box
                                component={ detail.route_url ? "a" : "span" }
                                href={ detail.route_url ?? undefined }
                                target={ detail.route_url ? "_blank" : undefined }
                                rel={ detail.route_url ? "noopener noreferrer" : undefined }
                                sx={{
                                    display: "inline-block",
                                    fontFamily: "var(--font-body)",
                                    fontWeight: 700,
                                    fontSize: "0.85rem",
                                    textDecoration: "none",
                                    px: 1,
                                    py: 0.375,
                                    borderRadius: "6px",
                                    backgroundColor: toCssColor(detail.route_color, "var(--coral)"),
                                    color: toCssColor(detail.route_text_color, "#fff"),
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    // xs: the close button no longer shares this row (it's
                                    // pinned absolutely), so the badge can use nearly all of
                                    // the header's own content width - dialog width (88vw)
                                    // minus its left padding (16px) and the reserved right
                                    // padding for the button (48px).
                                    maxWidth: { xs: "calc(88vw - 64px)", sm: "30vw" },
                                }}
                            >
                                { detail.route_long_name }
                            </Box>
                        </Tooltip>
                    )}
                    {/* Static (inline, next to the badge) on sm+; pinned to
                        the header's actual top-right corner on xs so it
                        stays put regardless of how the title/badge wrap. */}
                    <IconButton
                        onClick={onClose}
                        aria-label="Close trip detail"
                        sx={{
                            color: "var(--coral)",
                            position: { xs: "absolute", sm: "static" },
                            top: { xs: 8, sm: "auto" },
                            right: { xs: 8, sm: "auto" },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            </Box>
            <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
                {loading && (
                    <Typography sx={{ fontFamily: "var(--font-body)", color: "var(--ink-secondary)" }}>
                        Loading&hellip;
                    </Typography>
                )}
                {error && (
                    <Typography sx={{ fontFamily: "var(--font-body)", color: "var(--coral-ink)" }}>
                        {error}
                    </Typography>
                )}
                {detail && (
                    <>
                        {/* sm and up: full table. Below sm, a table needs
                            either a side-scroll or squished columns for all
                            five fields, so xs gets the stacked layout below
                            instead - taller per-stop blocks, no side scroll. */}
                        <TableContainer sx={{ display: { xs: "none", sm: "block" }, border: "1px solid var(--hairline)", borderRadius: "var(--radius)" }}>
                            <Table size="small" sx={{ minWidth: 560 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={stopHeadCellSx}>Stop</TableCell>
                                        <TableCell sx={stopHeadCellSx}>Arrival</TableCell>
                                        <TableCell sx={stopHeadCellSx}>Arrival delay</TableCell>
                                        <TableCell sx={stopHeadCellSx}>Departure</TableCell>
                                        <TableCell sx={stopHeadCellSx}>Departure delay</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    { detail.stops.map((stop, index) => {
                                        const isNext = index === nextStopIndex;
                                        const isDelayed = stop.arrival_delay != null && stop.arrival_delay > 0;
                                        return (
                                            <TableRow
                                                key={`${stop.stop_id}-${index}`}
                                                sx={[
                                                    { '&:hover': { backgroundColor: "var(--surface-raised)" } },
                                                    index % 2 === 1 ? stopStripeSx : {},
                                                    // --coral-tint, not --coral itself, so the row highlight
                                                    // never lands on the same hue/lightness as the blinking
                                                    // text pulsing through it. Listed last so it always wins
                                                    // over the zebra stripe above.
                                                    isNext ? { backgroundColor: "var(--coral-tint)" } : {},
                                                ]}
                                            >
                                                <TableCell sx={isNext ? [stopBodyCellSx, blinkSx] : stopBodyCellSx}>{ stop.stop_name ?? stop.stop_id }</TableCell>
                                                <TableCell sx={isNext ? [stopBodyCellSx, blinkSx] : stopBodyCellSx}>{ formatEpochSeconds(stop.arrival_time) }</TableCell>
                                                <TableCell sx={isNext && isDelayed ? [stopBodyCellSx, blinkSx] : stopBodyCellSx}>{ formatDelay(stop.arrival_delay) }</TableCell>
                                                <TableCell sx={stopBodyCellSx}>{ formatEpochSeconds(stop.departure_time) }</TableCell>
                                                <TableCell sx={stopBodyCellSx}>{ formatDelay(stop.departure_delay) }</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Box sx={{ display: { xs: "block", sm: "none" }, border: "1px solid var(--hairline)", borderRadius: "var(--radius)" }}>
                            { detail.stops.map((stop, index) => {
                                const isNext = index === nextStopIndex;
                                const isDelayed = stop.arrival_delay != null && stop.arrival_delay > 0;
                                return (
                                    <Box
                                        key={`m-${stop.stop_id}-${index}`}
                                        sx={[
                                            {
                                                px: 2,
                                                py: 1.5,
                                                borderBottom: "1px solid var(--hairline)",
                                                '&:last-of-type': { borderBottom: 0 },
                                            },
                                            index % 2 === 1 ? stopStripeSx : {},
                                            // Listed last so it always wins over the zebra stripe above.
                                            isNext ? { backgroundColor: "var(--coral-tint)" } : {},
                                        ]}
                                    >
                                        <Box sx={isNext ? [stopFieldValueSx, blinkSx, { fontSize: "1rem" }] : [stopFieldValueSx, { fontSize: "1rem" }]}>
                                            { stop.stop_name ?? stop.stop_id }
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, mt: 1 }}>
                                            <Box>
                                                <Box sx={stopFieldLabelSx}>Arrival</Box>
                                                <Box sx={isNext ? [stopFieldValueSx, blinkSx] : stopFieldValueSx}>
                                                    { formatEpochSeconds(stop.arrival_time) }
                                                </Box>
                                            </Box>
                                            <Box sx={{ textAlign: "right" }}>
                                                <Box sx={stopFieldLabelSx}>Arrival delay</Box>
                                                <Box sx={isNext && isDelayed ? [stopFieldValueSx, blinkSx] : stopFieldValueSx}>
                                                    { formatDelay(stop.arrival_delay) }
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, mt: 1 }}>
                                            <Box>
                                                <Box sx={stopFieldLabelSx}>Departure</Box>
                                                <Box sx={stopFieldValueSx}>{ formatEpochSeconds(stop.departure_time) }</Box>
                                            </Box>
                                            <Box sx={{ textAlign: "right" }}>
                                                <Box sx={stopFieldLabelSx}>Departure delay</Box>
                                                <Box sx={stopFieldValueSx}>{ formatDelay(stop.departure_delay) }</Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </>
                )}
            </Box>
        </Dialog>
    );
}
