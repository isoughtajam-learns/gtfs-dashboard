import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {Box, Checkbox, Divider, IconButton, ListItemText, Menu, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { keyframes } from "@emotion/react";
import TripDetailCard from "./TripDetailCard.tsx";

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

// `seq` is client-assigned at insert/update time, since nothing in the raw
// payload is otherwise guaranteed unique - it doubles as the row's React key,
// so bumping it on every update (not just on first insert) re-triggers the
// row's mount animation even when the row itself isn't moving.
type StreamedUpdate = TripUpdate & { seq: number };

// The server names every event, so `onmessage` (unnamed events only) never fires.
const EVENT_NAME = "trip_update";
const MAX_MESSAGES = 50;
const MAX_RETRY_DELAY_MS = 30_000;

// Every cell sets fontFamily explicitly rather than relying on
// inheriting it from the <Table>'s own sx: MUI's TableCell/TableHead
// assert their own theme-driven font-family directly, which wins over
// an ancestor's inherited value the way plain HTML/CSS wouldn't.
const headCellSx: SxProps<Theme> = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 600,
    color: "var(--ink-secondary)",
    borderColor: "var(--hairline)",
};

// GTFS route_color / route_text_color are six hex digits with the '#' omitted, so a
// raw feed value is not a valid CSS color. Falls back to theme tokens when absent.
const toCssColor = (value: string | null | undefined, fallback: string) => {
    if (!value) return fallback;
    return /^[0-9A-Fa-f]{6}$/.test(value) ? `#${value}` : value;
};

// Sortable columns; Line and Station are also filterable via a
// checked-value checklist
type SortField = "trip_headsign" | "stop_name" | "next";
type FilterField = "trip_headsign" | "stop_name";
type SortDirection = "asc" | "desc";
const isFilterField = (field: SortField): field is FilterField =>
    field === "trip_headsign" || field === "stop_name";

// GTFS trip_headsign is nullable (see the Line cell's own null check below);
// group those rows under one filterable bucket rather than dropping them.
const NO_LINE = "(No line)";
const lineFilterValue = (message: StreamedUpdate) => message.trip_headsign ?? NO_LINE;

// Classic three-line funnel: active sort/filter state is conveyed by the
// IconButton's own color (accent when this column has a sort or filter
// applied), not by the glyph itself.
function FilterIcon() {
    return (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
            <line x1="1" y1="1" x2="11" y2="1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="2.5" y1="5" x2="9.5" y2="5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="4.5" y1="9" x2="7.5" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

const menuPaperSx = {
    backgroundColor: "var(--surface-raised)",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius)",
    color: "var(--ink)",
    maxHeight: 360,
};
const menuItemSx = {
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    justifyContent: "flex-start",
    minHeight: "auto",
    "&:hover": { backgroundColor: "color-mix(in srgb, var(--coral) 16%, transparent)" },
};
const checkboxItemSx = { ...menuItemSx, py: 0.25, pl: 0.5 };
const checkboxSx = {
    color: "var(--ink-secondary)",
    p: 0.5,
    "&.Mui-checked": { color: "var(--coral)" },
};

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

    // Sort/filter state for the Line, Station, and Next column headers. These
    // apply to the live buffer (re-derived below via useMemo) rather than
    // freezing it, so the visible rows keep streaming and re-sort/re-filter
    // as new SSE events arrive.
    const [sort, setSort] = useState<{ field: SortField; direction: SortDirection } | null>(null);
    const [excludedValues, setExcludedValues] = useState<Record<FilterField, Set<string>>>({
        trip_headsign: new Set(),
        stop_name: new Set(),
    });
    const [headerMenu, setHeaderMenu] = useState<{ anchorEl: HTMLElement; field: SortField } | null>(null);

    // Which trip's detail card is open, if any - set by clicking a row.
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

    // Distinct values currently in the buffer, for the filter checklists.
    // Recomputed as messages stream in/age out, so the checklist always
    // reflects what's actually visible right now.
    const distinctValues: Record<FilterField, string[]> = useMemo(() => ({
        trip_headsign: Array.from(new Set(messages.map(lineFilterValue))).sort(),
        stop_name: Array.from(new Set(messages.map((m) => m.stop_name))).sort(),
    }), [messages]);

    const visibleMessages = useMemo(() => {
        const filtered = messages.filter((m) =>
            !excludedValues.trip_headsign.has(lineFilterValue(m)) &&
            !excludedValues.stop_name.has(m.stop_name)
        );
        if (!sort) return filtered;
        const sorted = [...filtered].sort((a, b) => {
            const cmp = sort.field === "next"
                ? a.next - b.next
                : sort.field === "trip_headsign"
                    ? lineFilterValue(a).localeCompare(lineFilterValue(b))
                    : a.stop_name.localeCompare(b.stop_name);
            return sort.direction === "asc" ? cmp : -cmp;
        });
        return sorted;
    }, [messages, excludedValues, sort]);

    const openHeaderMenu = (field: SortField) => (event: MouseEvent<HTMLElement>) =>
        setHeaderMenu({ anchorEl: event.currentTarget, field });
    const closeHeaderMenu = () => setHeaderMenu(null);

    const applySort = (field: SortField, direction: SortDirection) => {
        setSort({ field, direction });
        closeHeaderMenu();
    };
    const clearSort = () => {
        setSort(null);
        closeHeaderMenu();
    };
    const toggleFilterValue = (field: FilterField, value: string) => {
        setExcludedValues((prev) => {
            const next = new Set(prev[field]);
            if (next.has(value)) next.delete(value); else next.add(value);
            return { ...prev, [field]: next };
        });
    };
    const selectAllValues = (field: FilterField) =>
        setExcludedValues((prev) => ({ ...prev, [field]: new Set() }));
    const clearAllValues = (field: FilterField) =>
        setExcludedValues((prev) => ({ ...prev, [field]: new Set(distinctValues[field]) }));

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
                    setMessages((prev) => {
                        // The backend re-emits every active trip on every poll (not just
                        // the ones that changed), so the same trip_id shows up repeatedly
                        // over time - update that trip's existing row in place (a fresh
                        // seq still re-triggers its mount animation) rather than piling up
                        // duplicate rows for the same trip.
                        const existingIndex = prev.findIndex((m) => m.trip_id === row.trip_id);
                        if (existingIndex !== -1) {
                            const next = [...prev];
                            next[existingIndex] = row;
                            return next;
                        }
                        return [row, ...prev.slice(0, MAX_MESSAGES - 1)];
                    });
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
        <>
        <TableContainer
            component={Paper}
            sx={{
                fontFamily: "var(--font-body)",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--hairline)",
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
                        backgroundColor: "color-mix(in srgb, var(--coral-ink) 22%, transparent)",
                        color: "var(--coral-ink)",
                    }}
                >
                    Reconnecting&hellip; arrival times may be stale.
                </Box>
            )}
            <Table sx={{ minWidth: 650, tableLayout: 'fixed', borderCollapse: 'collapse', perspective: '600px', fontFamily: "var(--font-mono)" }} aria-label="simple table">
                <TableHead>
                    <TableRow>
                        <TableCell sx={headCellSx}>
                            Line
                            <IconButton
                                size="small"
                                onClick={openHeaderMenu("trip_headsign")}
                                aria-label="Sort or filter Line column"
                                sx={{
                                    color: (sort?.field === "trip_headsign" || excludedValues.trip_headsign.size > 0) ? "var(--coral)" : "inherit",
                                    p: 0.25,
                                    ml: 0.5,
                                    verticalAlign: "middle",
                                }}
                            >
                                <FilterIcon />
                            </IconButton>
                        </TableCell>
                        <TableCell align="right" sx={headCellSx}>
                            Station
                            <IconButton
                                size="small"
                                onClick={openHeaderMenu("stop_name")}
                                aria-label="Sort or filter Station column"
                                sx={{
                                    color: (sort?.field === "stop_name" || excludedValues.stop_name.size > 0) ? "var(--coral)" : "inherit",
                                    p: 0.25,
                                    ml: 0.5,
                                    verticalAlign: "middle",
                                }}
                            >
                                <FilterIcon />
                            </IconButton>
                        </TableCell>
                        {/*<TableCell align="right" sx={headCellSx}>Last</TableCell>*/}
                        <TableCell align="right" sx={headCellSx}>Status</TableCell>
                        <TableCell align="right" sx={headCellSx}>
                            Next
                            <IconButton
                                size="small"
                                onClick={openHeaderMenu("next")}
                                aria-label="Sort Next column"
                                sx={{
                                    color: sort?.field === "next" ? "var(--coral)" : "inherit",
                                    p: 0.25,
                                    ml: 0.5,
                                    verticalAlign: "middle",
                                }}
                            >
                                <FilterIcon />
                            </IconButton>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {visibleMessages.map((message) => (
                        <TableRow
                            key={ message.seq }
                            onClick={() => setSelectedTripId(message.trip_id)}
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
                                { message.trip_headsign != null && (
                                    <Tooltip title={message.trip_headsign}>
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
                                            { message.trip_headsign }
                                        </Box>
                                    </Tooltip>
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
                                        backgroundColor: "color-mix(in srgb, var(--ink-secondary) 20%, transparent)",
                                        color: "var(--ink-secondary)",
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
            <Menu
                anchorEl={headerMenu?.anchorEl ?? null}
                open={Boolean(headerMenu)}
                onClose={closeHeaderMenu}
                slotProps={{ paper: { sx: menuPaperSx } }}
            >
                {headerMenu && [
                    <MenuItem key="asc" onClick={() => applySort(headerMenu.field, "asc")} sx={menuItemSx}>
                        Sort Ascending
                    </MenuItem>,
                    <MenuItem key="desc" onClick={() => applySort(headerMenu.field, "desc")} sx={menuItemSx}>
                        Sort Descending
                    </MenuItem>,
                    ...(sort?.field === headerMenu.field
                        ? [<MenuItem key="clear-sort" onClick={clearSort} sx={menuItemSx}>Clear Sort</MenuItem>]
                        : []),
                    ...(isFilterField(headerMenu.field)
                        ? [
                            <Divider key="divider" sx={{ borderColor: "var(--hairline)", my: 0.5 }} />,
                            <MenuItem key="select-all" onClick={() => selectAllValues(headerMenu.field as FilterField)} sx={menuItemSx}>
                                Select All
                            </MenuItem>,
                            <MenuItem key="clear-all" onClick={() => clearAllValues(headerMenu.field as FilterField)} sx={menuItemSx}>
                                Clear All
                            </MenuItem>,
                            ...distinctValues[headerMenu.field as FilterField].map((value) => (
                                <MenuItem
                                    key={`value-${value}`}
                                    onClick={() => toggleFilterValue(headerMenu.field as FilterField, value)}
                                    sx={checkboxItemSx}
                                >
                                    <Checkbox
                                        size="small"
                                        checked={!excludedValues[headerMenu.field as FilterField].has(value)}
                                        sx={checkboxSx}
                                        tabIndex={-1}
                                        disableRipple
                                    />
                                    <ListItemText primary={value} />
                                </MenuItem>
                            )),
                        ]
                        : []),
                ]}
            </Menu>
        </TableContainer>
        <TripDetailCard
            systemId={systemId}
            tripId={selectedTripId}
            onClose={() => setSelectedTripId(null)}
        />
        </>
    )
}
