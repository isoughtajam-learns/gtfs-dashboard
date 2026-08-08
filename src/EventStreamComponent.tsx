import { useEffect, useRef, useState } from 'react';
import {Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";

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

const FONT = "WU3 Segments Regular";

// Eggplant header against the gray paper, with the light pink as the divider tint.
const headCellSx: SxProps<Theme> = {
    fontFamily: FONT,
    fontSize: "small",
    backgroundColor: "primary.main",
    color: "primary.contrastText",
    borderColor: (theme) => alpha(theme.palette.primary.light, 0.5),
};

// GTFS route_color / route_text_color are six hex digits with the '#' omitted, so a
// raw feed value is not a valid CSS color. Falls back to palette tokens when absent.
const toCssColor = (value: string | null | undefined, fallback: string) => {
    if (!value) return fallback;
    return /^[0-9A-Fa-f]{6}$/.test(value) ? `#${value}` : value;
};

// Fraction of the feed color kept in a pill; the rest blends toward the paper so
// saturated route colors sit back a little. An opaque blend rather than alpha(),
// since the row striping underneath would otherwise tint alternating rows.
const PILL_MUTE = 0.52;

const bodyCellSx: SxProps<Theme> = {
    fontFamily: FONT,
    fontSize: "x-small",
    color: "common.white",
    borderColor: (theme) => alpha(theme.palette.primary.main, 0.4),
};

export default function EventStreamComponent() {
    const [messages, setMessages] = useState<StreamedUpdate[]>([]);
    const [connected, setConnected] = useState(false);
    // A ref, not an effect-local counter: it has to outlive reconnects and StrictMode's
    // double-mount, both of which would otherwise restart numbering into a live list.
    const seqRef = useRef(0);

    useEffect(() => {
        let eventSource: EventSource | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let attempt = 0;
        let disposed = false;

        const connect = () => {
            eventSource = new EventSource("http://127.0.0.1:8000/trip_updates/BART");

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
    }, []);

    return (
        <TableContainer component={Paper} variant="outlined" sx={{ fontFamily: FONT, borderColor: "primary.main" }}>
            { !connected && (
                <Box role="status" sx={{ fontFamily: FONT, fontSize: "x-small", px: 2, py: 0.5, backgroundColor: "secondary.main", color: "secondary.contrastText" }}>
                    Reconnecting&hellip; arrival times may be stale.
                </Box>
            )}
            <Table sx={{ minWidth: 650, tableLayout: 'fixed' }} aria-label="simple table">
                <TableHead sx={{ fontSize: "small" }}>
                    <TableRow>
                        <TableCell sx={headCellSx}>Headsign</TableCell>
                        <TableCell align="right" sx={headCellSx}>Station</TableCell>
                        {/*<TableCell align="right" sx={headCellSx}>Last</TableCell>*/}
                        <TableCell align="right" sx={headCellSx}>Status</TableCell>
                        <TableCell align="right" sx={headCellSx}>Next</TableCell>
                        <TableCell align="right" sx={headCellSx}>Vehicle</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {messages.map((message) => (
                        <TableRow
                            key={ message.seq }
                            sx={(theme) => ({
                                '&:nth-of-type(odd)': { backgroundColor: alpha(theme.palette.primary.light, 0.18) },
                                '&:hover': { backgroundColor: alpha(theme.palette.secondary.main, 0.28) },
                                '&:last-child td, &:last-child th': { border: 0 },
                            })}
                        >
                            <TableCell component="th" scope="row" sx={bodyCellSx}>
                                { message.trip_headsign != null && (
                                    <Box
                                        component="span"
                                        sx={(theme) => ({
                                            display: "inline-block",
                                            px: 1,
                                            py: 0.25,
                                            borderRadius: "999px",
                                            whiteSpace: "nowrap",
                                            backgroundColor: `color-mix(in srgb, ${toCssColor(message.color, theme.palette.primary.main)} ${PILL_MUTE * 100}%, ${theme.palette.background.paper})`,
                                            color: toCssColor(message.text_color, theme.palette.primary.contrastText),
                                        })}
                                    >
                                        { message.trip_headsign }
                                    </Box>
                                )}
                            </TableCell>
                            <TableCell align="right" sx={bodyCellSx}>{ message.stop_name }</TableCell>
                            <TableCell align="right" sx={bodyCellSx}>{ message.status }</TableCell>
                            <Tooltip title={message.status == "Stopped" ? "Previous Arrival: "  + new Date(message.previous * 1000).toLocaleTimeString() : "Previous Departure: " + new Date(message.previous * 1000).toLocaleTimeString()}>
                                <TableCell align="right" sx={bodyCellSx}>{ new Date(message.next * 1000).toLocaleTimeString() }</TableCell>
                            </Tooltip>
                            <TableCell align="right" sx={bodyCellSx}>{ message.vehicle }</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    )
}