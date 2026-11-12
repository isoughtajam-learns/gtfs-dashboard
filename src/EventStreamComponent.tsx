import { useState } from 'react';
import { Box, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import TripDetailCard from "./TripDetailCard.tsx";
import type { TransitSystem } from "./transitSystems.ts";
import { useTripUpdateStream } from "./useTripUpdateStream.ts";
import { useTripFilters, COLUMN_LABELS } from "./useTripFilters.ts";
import { FilterHeaderMenu, SortFilterIconButton } from "./FilterHeaderMenu.tsx";
import MobileFilterToolbar from "./MobileFilterToolbar.tsx";
import { StatusMessage } from "./StatusMessage.tsx";
import { TripCard, TripTableRow } from "./TripRow.tsx";

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

type EventStreamComponentProps = {
    systemId: string;
    systems: TransitSystem[];
    onSystemChange: (systemId: string) => void;
};

// Orchestrates the live trip feed for one transit system: the SSE
// connection (useTripUpdateStream), the Line/Station/Next sort+filter state
// (useTripFilters), and the desktop table / mobile card presentation,
// handing most of the actual rendering off to focused components so this
// one stays about composing them rather than owning every concern itself.
export default function EventStreamComponent({ systemId, systems, onSystemChange }: EventStreamComponentProps) {
    // Computed once here rather than re-checked at each of this component's
    // own TransferIndicators call sites (see TransferIndicators.tsx's own
    // comment on why BART alone gets compact dots).
    const compactIntra = systemId === "BART";

    // Which trip's detail card is open, if any - set by clicking a row.
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

    const { messages, connected, settled, outsideOperatingHours } = useTripUpdateStream(systemId);
    const {
        sort,
        excludedValues,
        distinctValues,
        visibleMessages,
        headerMenu,
        filterSearch,
        setFilterSearch,
        openHeaderMenu,
        closeHeaderMenu,
        applySort,
        clearSort,
        toggleFilterValue,
        selectAllValues,
        clearAllValues,
        resetAllFilters,
        isColumnActive,
        anyColumnActive,
    } = useTripFilters(systemId, messages);

    // Shown in place of rows when the filters (not a genuinely empty
    // buffer - see the messages.length===0 branch below) exclude every
    // message. Deliberately rendered *inside* the existing table/card
    // regions rather than replacing them outright - on sm+ that keeps the
    // header row (and its per-column filter icons) mounted, so a desktop
    // user who filtered down to nothing can still reopen a single column's
    // checklist to uncheck one value, not just blow away every filter via
    // Clear filters below.
    const noResultsContent = (
        <StatusMessage>
            <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--ink-secondary)" }}>
                No trips match the current filters
            </Box>
            <Box
                component="button"
                onClick={resetAllFilters}
                sx={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    color: "var(--coral)",
                    backgroundColor: "transparent",
                    border: "1px solid var(--hairline)",
                    borderRadius: "20px",
                    px: 1.5,
                    py: 0.5,
                    cursor: "pointer",
                }}
            >
                Clear filters
            </Box>
        </StatusMessage>
    );

    return (
        <>
        <Box
            sx={{
                fontFamily: "var(--font-body)",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: "var(--radius)",
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

            <MobileFilterToolbar
                systems={systems}
                systemId={systemId}
                onSystemChange={onSystemChange}
                isColumnActive={isColumnActive}
                anyColumnActive={anyColumnActive}
                onOpenHeaderMenu={openHeaderMenu}
            />

            { messages.length === 0 ? (
                outsideOperatingHours?.outside_operating_hours ? (
                    // Authoritative, schedule-derived answer (see
                    // useTripUpdateStream's outsideOperatingHours comment) -
                    // takes precedence over the settled/spinner guess below,
                    // which stays the fallback for a system this can't be
                    // determined for (no known timezone/calendar data).
                    <StatusMessage>
                        <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--ink-secondary)" }}>
                            Outside operating hours
                            {outsideOperatingHours.next_service_starts_at && (
                                <>
                                    {" "}- back at{" "}
                                    {new Date(outsideOperatingHours.next_service_starts_at).toLocaleTimeString([], {
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </>
                            )}
                        </Box>
                    </StatusMessage>
                ) : settled ? (
                    // Confirmed, not just "haven't heard back yet": this
                    // system's poll cycle had a fair chance (see
                    // useTripUpdateStream's `settled` comment) and produced
                    // nothing - a real system state (e.g. NY Waterway
                    // overnight), not a bug.
                    <StatusMessage>
                        <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--ink-secondary)" }}>
                            No active trips right now
                        </Box>
                    </StatusMessage>
                ) : (
                    // Covers both the initial connect and a system switch
                    // (which clears messages) - gone the moment the first SSE
                    // event for this system lands, or the settle timer
                    // expires with nothing to show (see above).
                    <StatusMessage>
                        <CircularProgress sx={{ color: "var(--coral)" }} />
                        <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--ink-secondary)" }}>
                            Loading arrivals&hellip;
                        </Box>
                    </StatusMessage>
                )
            ) : (
            <>
            {/* sm and up: the full table. Below sm it doesn't degrade
                gracefully (tableLayout:'fixed' + minWidth:650 would force
                either horizontal scroll or over-squished columns), so xs
                gets the stacked-card layout below instead. */}
            <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
                <Table sx={{ minWidth: 650, tableLayout: 'fixed', borderCollapse: 'collapse', perspective: '600px', fontFamily: "var(--font-mono)" }} aria-label="simple table">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={headCellSx}>
                                { COLUMN_LABELS.trip_headsign }
                                <SortFilterIconButton
                                    label="Sort or filter Line column"
                                    active={isColumnActive("trip_headsign")}
                                    onClick={openHeaderMenu("trip_headsign")}
                                />
                            </TableCell>
                            <TableCell sx={headCellSx}>
                                { COLUMN_LABELS.stop_name }
                                <SortFilterIconButton
                                    label="Sort or filter Station column"
                                    active={isColumnActive("stop_name")}
                                    onClick={openHeaderMenu("stop_name")}
                                />
                            </TableCell>
                            <TableCell align="center" sx={headCellSx}>Status</TableCell>
                            <TableCell align="right" sx={headCellSx}>
                                { COLUMN_LABELS.next }
                                <SortFilterIconButton
                                    label="Sort Next column"
                                    active={isColumnActive("next")}
                                    onClick={openHeaderMenu("next")}
                                />
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleMessages.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} sx={{ border: 0 }}>
                                    {noResultsContent}
                                </TableCell>
                            </TableRow>
                        ) : visibleMessages.map((message) => (
                            <TripTableRow
                                key={message.seq}
                                message={message}
                                compactIntra={compactIntra}
                                onSelect={() => setSelectedTripId(message.trip_id)}
                                onSystemChange={onSystemChange}
                            />
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Below sm: one stacked card per trip instead of table rows.
                The toolbar (chevron/filters/transit picker) itself lives
                above, outside this branch, so it stays visible even with no
                data yet. */}
            <Box sx={{ display: { xs: "block", sm: "none" } }}>
                {visibleMessages.length === 0 ? noResultsContent : visibleMessages.map((message) => (
                    <TripCard
                        key={message.seq}
                        message={message}
                        compactIntra={compactIntra}
                        onSelect={() => setSelectedTripId(message.trip_id)}
                        onSystemChange={onSystemChange}
                    />
                ))}
            </Box>
            </>
            )}

            <FilterHeaderMenu
                headerMenu={headerMenu}
                onClose={closeHeaderMenu}
                sort={sort}
                distinctValues={distinctValues}
                excludedValues={excludedValues}
                filterSearch={filterSearch}
                onFilterSearchChange={setFilterSearch}
                onApplySort={applySort}
                onClearSort={clearSort}
                onToggleValue={toggleFilterValue}
                onSelectAll={selectAllValues}
                onClearAll={clearAllValues}
            />
        </Box>
        <TripDetailCard
            systemId={systemId}
            tripId={selectedTripId}
            onClose={() => setSelectedTripId(null)}
            onSwitchSystem={(transferSystemId) => {
                // Only close the card when the switch will actually happen -
                // App.tsx's handleSystemChange silently no-ops an id that
                // isn't in `systems` (stale/unverified transfer data), and
                // closing the card anyway would look like a successful
                // switch when nothing happened. Same "systems hasn't loaded
                // yet" leniency as handleSystemChange's own guard - an empty
                // systems list means "unverifiable", not "invalid".
                if (systems.length > 0 && !systems.some((s) => s.id === transferSystemId)) return;
                onSystemChange(transferSystemId);
                setSelectedTripId(null);
            }}
        />
        </>
    )
}
