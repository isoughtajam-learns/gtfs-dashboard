import { useEffect, useRef, useState } from 'react';
import {Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { keyframes } from "@emotion/react";

type TripUpdate = {
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
};

// `seq` is client-assigned at insert time: the same trip reappears as it progresses,
// so nothing in the payload is unique across the rolling window.
type StreamedUpdate = TripUpdate & { seq: number };

// The server names every event, so `onmessage` (unnamed events only) never fires.
const EVENT_NAME = "trip_update";
const MAX_MESSAGES = 50;
const MAX_RETRY_DELAY_MS = 30_000;

// Bahnhof design system (bahnhof-design-spec.md). Every cell sets
// fontFamily explicitly rather than relying on inheriting it from the
// <Table>'s own sx: MUI's TableCell/TableHead assert their own
// theme-driven font-family directly, which wins over an ancestor's
// inherited value the way plain HTML/CSS wouldn't.
const headCellSx: SxProps<Theme> = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.65625rem", // 10.5px
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 600,
    color: "var(--ink-dim)",
    borderColor: "var(--line)",
};

// GTFS route_color / route_text_color are six hex digits with the '#' omitted, so a
// raw feed value is not a valid CSS color. Falls back to theme tokens when absent.
const toCssColor = (value: string | null | undefined, fallback: string) => {
    if (!value) return fallback;
    return /^[0-9A-Fa-f]{6}$/.test(value) ? `#${value}` : value;
};

// Fraction of the feed's route color kept in the headsign chip; the rest blends
// toward the panel background so saturated colors sit back a little instead of
// glaring against the muted Bahnhof palette. Uniform across all routes.
const HEADSIGN_MUTE = 0.7;

const bodyCellSx = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.71875rem",
    color: "var(--ink)",
    borderColor: "var(--line)",
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
// rolling log where every SSE event is inherently a brand-new row (see the
// seq comment above), so "only changed rows animate" here means "only the
// row that just arrived animates": existing rows keep their DOM node (same
// `key`) as they shift position, so this animation never re-fires for them.
const flapIn = keyframes`
    from { transform: rotateX(-90deg); opacity: 0; }
    to { transform: rotateX(0deg); opacity: 1; }
`;

type EventStreamComponentProps = {
    systemId: string;
};

export default function EventStreamComponent({ systemId }: EventStreamComponentProps) {
    const [messages, setMessages] = useState<StreamedUpdate[]>([]);
    const [connected, setConnected] = useState(false);
    // A ref, not an effect-local counter: it has to outlive reconnects and StrictMode's
    // double-mount, both of which would otherwise restart numbering into a live list.
    const seqRef = useRef(0);

    useEffect(() => {
        // Empty until the transit system list has loaded and picked a default.
        if (!systemId) return;

        // Switching systems starts a fresh window rather than mixing feeds.
        setMessages([]);

        let eventSource: EventSource | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let attempt = 0;
        let disposed = false;

        // Relative so it resolves against whatever host serves the app: nginx proxies
        // /api/ in the container, Vite's dev server proxies it locally.
        const streamUrl = `/api/trip_updates/${systemId}`;

        const connect = () => {
            eventSource = new EventSource(streamUrl);

            eventSource.onopen = () => {
                attempt = 0;
                setConnected(true);
            };

            eventSource.addEventListener(EVENT_NAME, (event) => {
                try {
                    const newEventData: TripUpdate = JSON.parse(event.data);
                    const row: StreamedUpdate = { ...newEventData, seq: seqRef.current++ };
                    setMessages((prev) => [row, ...prev.slice(0, MAX_MESSAGES - 1)]);
                } catch {
                    console.error("Malformed SSE payload:", event.data);
                }
            });

            eventSource.onerror = () => {
                setConnected(false);

                // CONNECTING means EventSource is already retrying on its own.
                if (eventSource?.readyState === EventSource.CONNECTING) return;

                // CLOSED: the browser gave up, so reconnect with backoff.
                eventSource?.close();
                if (disposed) return;
                const delay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
                attempt += 1;
                retryTimer = setTimeout(connect, delay + Math.random() * 250);
            };
        };

        connect();

        return () => {
            disposed = true;
            clearTimeout(retryTimer);
            eventSource?.close();
        };
    }, [systemId]);

    return (
        <TableContainer
            component={Paper}
            sx={{
                fontFamily: "var(--font-body)",
                backgroundColor: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                boxShadow: "none",
            }}
        >
            { !connected && (
                <Box
                    role="status"
                    sx={{
                        fontFamily: "var(--font-body)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        px: 2,
                        py: 0.5,
                        backgroundColor: "color-mix(in srgb, var(--rust) 22%, transparent)",
                        color: "var(--rust)",
                    }}
                >
                    Reconnecting&hellip; arrival times may be stale.
                </Box>
            )}
            <Table sx={{ minWidth: 650, tableLayout: 'fixed', borderCollapse: 'collapse', perspective: '600px', fontFamily: "var(--font-mono)" }} aria-label="simple table">
                <TableHead>
                    <TableRow>
                        <TableCell sx={headCellSx}>Line</TableCell>
                        <TableCell align="right" sx={headCellSx}>Station</TableCell>
                        {/*<TableCell align="right" sx={headCellSx}>Last</TableCell>*/}
                        <TableCell align="right" sx={headCellSx}>Status</TableCell>
                        <TableCell align="right" sx={headCellSx}>Next</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {messages.map((message) => (
                        <TableRow
                            key={ message.seq }
                            sx={{
                                animation: `${flapIn} 180ms ease-out`,
                                transformOrigin: "top",
                                // No zebra striping (Bahnhof spec: row borders only).
                                '&:hover': { backgroundColor: "var(--bg-elev)" },
                                '&:last-child td, &:last-child th': { border: 0 },
                            }}
                        >
                            <TableCell component="th" scope="row" sx={bodyCellSx}>
                                { message.trip_headsign != null && (
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
                                            backgroundColor: `color-mix(in srgb, ${toCssColor(message.color, "var(--brass)")} ${HEADSIGN_MUTE * 100}%, var(--panel))`,
                                            color: toCssColor(message.text_color, "#fff"),
                                            maxWidth: "100%",
                                        }}
                                    >
                                        { message.trip_headsign }
                                    </Box>
                                )}
                            </TableCell>
                            <TableCell align="right" sx={bodyCellSx}>{ message.stop_name }</TableCell>
                            <TableCell align="right" sx={bodyCellSx}>
                                {/* Neutral treatment: "Stopped"/"In Transit" is a motion
                                    state, not schedule adherence, so both statuses use the
                                    same coloring rather than the spec's --ok/--rust pair
                                    (which would misleadingly imply one is "bad"). */}
                                <Box
                                    component="span"
                                    sx={{
                                        display: "inline-block",
                                        px: 1,
                                        py: 0.375,
                                        borderRadius: "20px",
                                        backgroundColor: "color-mix(in srgb, var(--ink-dim) 20%, transparent)",
                                        color: "var(--ink-dim)",
                                    }}
                                >
                                    { message.status }
                                </Box>
                            </TableCell>
                            <Tooltip title={message.status == "Stopped" ? "Previous Arrival: "  + new Date(message.previous * 1000).toLocaleTimeString() : "Previous Departure: " + new Date(message.previous * 1000).toLocaleTimeString()}>
                                <TableCell align="right" sx={[bodyCellSx, { letterSpacing: "0.05em" }]}>
                                    { new Date(message.next * 1000).toLocaleTimeString() }
                                </TableCell>
                            </Tooltip>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    )
}
