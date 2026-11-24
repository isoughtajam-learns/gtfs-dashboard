import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Box, IconButton, MenuItem, Select, Switch, Typography } from "@mui/material";
import { useAuth } from "./AuthContext.tsx";
import * as savedStationsApi from "./savedStations.ts";
import type { SavedStation } from "./savedStations.ts";
import { fetchTransitSystems } from "./transitSystems.ts";
import type { TransitSystem } from "./transitSystems.ts";
import { fetchAllStops } from "./filterOptions.ts";
import TransitSystemSelect from "./TransitSystemSelect.tsx";
import { StatusMessage } from "./StatusMessage.tsx";

function TrashIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.6 9.5a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function MinusIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

const rowSx = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    px: 2,
    py: 1.25,
    borderBottom: "1px solid var(--hairline)",
    flexWrap: "wrap" as const,
};
const leadMinutesFieldSx = {
    width: 56,
    boxSizing: "border-box" as const,
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    padding: "4px 6px",
    borderRadius: "6px",
    border: "1px solid var(--hairline)",
    backgroundColor: "var(--surface)",
    color: "var(--ink)",
    outline: "none",
};

const LEAD_MINUTES_MIN = 1;
const LEAD_MINUTES_MAX = 60;

const stepperButtonSx = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    minWidth: 28,
    padding: 0,
    borderRadius: "6px",
    border: "1px solid var(--hairline)",
    backgroundColor: "var(--surface)",
    color: "var(--ink)",
    cursor: "pointer",
    "&:disabled": { opacity: 0.4, cursor: "default" },
    "&:not(:disabled):hover": { backgroundColor: "color-mix(in srgb, var(--coral) 16%, transparent)" },
};
const stepperValueSx = {
    minWidth: 20,
    textAlign: "center" as const,
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    color: "var(--ink)",
};

// Clamps an in-range number, rounds a fractional one - returns null only
// for text that isn't a number at all (empty, letters, ...), which the
// caller falls back to reverting rather than guessing at.
function clampLeadMinutes(raw: string): number | null {
    // Number("") === 0, which IS finite - without this check an emptied
    // field (selected-all-and-deleted to retype) clamped to 1 instead of
    // falling into the null/revert branch below, silently committing 1
    // if the field lost focus before a digit was typed.
    if (raw.trim() === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return Math.min(LEAD_MINUTES_MAX, Math.max(LEAD_MINUTES_MIN, Math.round(value)));
}

// sm and up: a plain text field, not a number spinner - a number input's
// up/down arrows were the only reliable way to change it, since every
// keystroke was previously validated and clamped immediately, which
// silently rejected the in-between state of clearing the first digit to
// retype it. This only validates once, on blur/Enter, so an in-progress
// edit is never fought mid-keystroke; an out-of-range value clamps to
// 1-60 instead of reverting. Below sm, a +/- stepper instead - tried a
// dropdown first, but scrolling a 60-item list is worse than a keyboard
// on a touch screen, and a text field there has the same clunky-keyboard
// problem this whole component exists to avoid. A single-step tap is the
// right tradeoff for this range (most values picked are small, 1-15);
// revisit with a larger step or press-to-accelerate if that stops holding.
function AlertLeadMinutesField({
    value,
    disabled,
    onCommit,
}: {
    value: number;
    disabled: boolean;
    onCommit: (minutes: number) => void;
}) {
    const [text, setText] = useState(String(value));

    // Re-syncs after a successful commit round-trips back through props
    // (or if another client/tab changed it) - safe to do unconditionally
    // since this only ever fires from a prop change, never while the
    // field itself is mid-edit (nothing commits until blur/Enter below).
    useEffect(() => {
        setText(String(value));
    }, [value]);

    const commit = () => {
        const clamped = clampLeadMinutes(text);
        if (clamped === null) {
            // Not a number at all - nothing sane to clamp to, so revert.
            setText(String(value));
            return;
        }
        if (clamped !== value) {
            onCommit(clamped);
        } else {
            // Clamped back to the same value (e.g. typed "005", or the old
            // value re-typed) - still normalize the displayed text.
            setText(String(clamped));
        }
    };

    return (
        <>
            <Box
                component="input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={disabled}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={commit}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        commit();
                    }
                }}
                sx={{ ...leadMinutesFieldSx, display: { xs: "none", sm: "inline-block" } }}
            />
            <Box sx={{ display: { xs: "inline-flex", sm: "none" }, alignItems: "center", gap: 0.5 }}>
                <Box
                    component="button"
                    type="button"
                    disabled={disabled || value <= LEAD_MINUTES_MIN}
                    onClick={() => onCommit(Math.max(LEAD_MINUTES_MIN, value - 1))}
                    aria-label="Decrease alert lead time"
                    sx={stepperButtonSx}
                >
                    <MinusIcon />
                </Box>
                <Box sx={stepperValueSx}>{value}</Box>
                <Box
                    component="button"
                    type="button"
                    disabled={disabled || value >= LEAD_MINUTES_MAX}
                    onClick={() => onCommit(Math.min(LEAD_MINUTES_MAX, value + 1))}
                    aria-label="Increase alert lead time"
                    sx={stepperButtonSx}
                >
                    <PlusIcon />
                </Box>
            </Box>
        </>
    );
}

const createRowSx = {
    ...rowSx,
    borderBottom: "none",
    pb: 2,
};
// Same recipe as TransitSystemSelect.tsx's own menuPaperSx/menuItemSx -
// each caller in this codebase (Header.tsx, FilterHeaderMenu.tsx) keeps its
// own local copy rather than sharing one, so this follows suit.
const stationMenuPaperSx = {
    backgroundColor: "var(--surface-raised)",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius)",
    color: "var(--ink)",
    fontFamily: "var(--font-body)",
    // Without a cap, a long unfiltered station list overflows the
    // viewport and MUI's Popover shifts the menu up to fit it (see
    // Popover.js's marginThreshold/heightThreshold clamp), while a short
    // filtered list doesn't overflow and stays anchored right below the
    // field - the menu visibly jumps between the two. Capping height (same
    // value as FilterHeaderMenu.tsx's own menuPaperSx) keeps the list
    // scrolling internally instead, so the anchor point never needs to move.
    maxHeight: 360,
};
const stationMenuItemSx = {
    fontFamily: "var(--font-body)",
    "&:hover": { backgroundColor: "color-mix(in srgb, var(--coral) 16%, transparent)" },
    "&.Mui-selected": {
        backgroundColor: "color-mix(in srgb, var(--coral) 22%, transparent)",
        "&:hover": { backgroundColor: "color-mix(in srgb, var(--coral) 28%, transparent)" },
    },
};
const stationSelectSx = {
    fontFamily: "var(--font-body)",
    fontSize: "0.9rem",
    color: "var(--ink)",
    backgroundColor: "var(--surface)",
    border: "1px solid var(--hairline)",
    borderRadius: "8px",
    minWidth: 180,
    "& .MuiSelect-select": {
        py: "7px !important",
        pl: "10px !important",
        pr: "28px !important",
    },
    "&.Mui-disabled": { opacity: 0.6 },
};
const createAlertButtonSx = {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "0.85rem",
    padding: "7px 16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "var(--coral)",
    color: "#fff",
    cursor: "pointer",
    "&:disabled": { opacity: 0.5, cursor: "default" },
};
// Same recipe as FilterHeaderMenu.tsx's own search box - a raw <input>
// injected as the menu's first child rather than a MenuItem, since it's
// text entry, not a selectable option.
const stationSearchBoxSx = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    px: 1.5,
    py: 0.75,
    listStyle: "none",
};
const stationSearchInputSx = {
    flex: "1 1 auto",
    minWidth: 0,
    boxSizing: "border-box",
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    padding: "6px 8px",
    borderRadius: "6px",
    border: "1px solid var(--hairline)",
    backgroundColor: "var(--surface)",
    color: "var(--ink)",
    outline: "none",
};
const stationSearchClearButtonSx = {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    fontSize: "0.9rem",
    lineHeight: 1,
    color: "var(--ink-secondary)",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    "&:hover": { color: "var(--coral)" },
};

// Mirrors the "existing alerts" block's own styling (same container, same
// AlertLeadMinutesField component/clamp range) so a new alert looks like it
// belongs next to the ones it's about to join.
function CreateAlertBlock({
    systems,
    existingStations,
    onCreate,
}: {
    systems: TransitSystem[];
    existingStations: SavedStation[];
    onCreate: (systemId: string, stopName: string, leadMinutes: number) => Promise<void>;
}) {
    const [systemId, setSystemId] = useState("");
    const [stopOptions, setStopOptions] = useState<string[]>([]);
    const [stopsLoading, setStopsLoading] = useState(false);
    const [stopName, setStopName] = useState("");
    const [stationSearch, setStationSearch] = useState("");
    const [leadMinutes, setLeadMinutes] = useState(5);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Lets handleCreate's resolution below check, once the request
    // settles, whether this exact (system, station) is still what's
    // selected - same requestSystemId convention as useSavedStations.ts's
    // save/unsave/updateAlert. Without it, a slow create for an earlier
    // selection that resolves after the user has already moved on to a
    // different station clobbers that new, unsubmitted selection: wiping
    // it back to blank on a stale success, or redisplaying a stale error
    // that no longer applies to what's on screen.
    const systemIdRef = useRef(systemId);
    const stopNameRef = useRef(stopName);
    useEffect(() => {
        systemIdRef.current = systemId;
        stopNameRef.current = stopName;
    }, [systemId, stopName]);

    // Same clear-then-refetch-on-system-change convention as
    // useTripFilters.ts's fetchAllStops effect, guarded against a stale
    // system's response landing after a newer selection.
    useEffect(() => {
        setStopName("");
        setStationSearch("");
        // A create error names a specific station ("already saved") -
        // leaving it up once the user moves to a different system/station
        // would wrongly read as still applying to the new selection.
        setError(null);
        if (!systemId) { setStopOptions([]); return; }
        let cancelled = false;
        setStopsLoading(true);
        void fetchAllStops(systemId)
            .then((names) => { if (!cancelled) setStopOptions(names); })
            .catch((fetchError: unknown) => {
                console.error("Failed to fetch stops:", fetchError);
                if (!cancelled) setStopOptions([]);
            })
            .finally(() => { if (!cancelled) setStopsLoading(false); });
        return () => { cancelled = true; };
    }, [systemId]);

    // Hides stations already saved for this system instead of letting the
    // user pick one and hit a 409 from the backend's own uniqueness check.
    const alreadySaved = new Set(
        existingStations.filter((s) => s.transit_system === systemId).map((s) => s.stop_name),
    );
    const availableStopOptions = stopOptions.filter((name) => !alreadySaved.has(name));
    const filteredStopOptions = stationSearch
        ? availableStopOptions.filter((name) => name.toLowerCase().includes(stationSearch.toLowerCase()))
        : availableStopOptions;

    const canCreate = systemId !== "" && stopName !== "" && !submitting;

    const handleCreate = () => {
        if (!canCreate) return;
        const requestSystemId = systemId;
        const requestStopName = stopName;
        setSubmitting(true);
        setError(null);
        onCreate(requestSystemId, requestStopName, leadMinutes)
            .then(() => {
                if (systemIdRef.current !== requestSystemId || stopNameRef.current !== requestStopName) return;
                setStopName("");
                setLeadMinutes(5);
            })
            .catch((createError: unknown) => {
                if (systemIdRef.current !== requestSystemId || stopNameRef.current !== requestStopName) return;
                setError(
                    createError instanceof savedStationsApi.SavedStationsError
                        ? createError.message
                        : "Failed to create alert.",
                );
            })
            .finally(() => setSubmitting(false));
    };

    return (
        <Box sx={{ maxWidth: 720, mx: "auto", mt: 2, backgroundColor: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)" }}>
            <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem", color: "var(--ink)", px: 2, pt: 2, pb: 1 }}>
                Create new alert
            </Typography>
            <Box sx={createRowSx}>
                <TransitSystemSelect
                    systems={systems}
                    selectedSystemId={systemId}
                    onSystemChange={setSystemId}
                    placeholder="Select a transit system"
                />
                <Select
                    value={stopName}
                    onChange={(e) => { setStopName(e.target.value); setStationSearch(""); setError(null); }}
                    size="small"
                    variant="standard"
                    disableUnderline
                    displayEmpty
                    disabled={!systemId || stopsLoading}
                    inputProps={{ "aria-label": "Station" }}
                    MenuProps={{ slotProps: { paper: { sx: stationMenuPaperSx } } }}
                    sx={stationSelectSx}
                >
                    {systemId && !stopsLoading && (
                        // Plain <li> rather than a MenuItem - text entry, not
                        // a selectable option. Same convention (and stopped-
                        // propagation guard so typing doesn't trigger MenuList's
                        // own letter-key typeahead) as FilterHeaderMenu.tsx's
                        // station search box in the live feed.
                        <Box
                            component="li"
                            onKeyDown={(e) => { if (e.key !== "Escape") e.stopPropagation(); }}
                            sx={stationSearchBoxSx}
                        >
                            <Box
                                component="input"
                                autoFocus
                                value={stationSearch}
                                onChange={(e) => setStationSearch(e.target.value)}
                                placeholder="Search stations…"
                                sx={stationSearchInputSx}
                            />
                            {stationSearch && (
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={() => setStationSearch("")}
                                    aria-label="Clear station search"
                                    sx={stationSearchClearButtonSx}
                                >
                                    &times;
                                </Box>
                            )}
                        </Box>
                    )}
                    <MenuItem value="" disabled sx={stationMenuItemSx}>
                        {!systemId
                            ? "Select a transit system first"
                            : stopsLoading
                              ? "Loading…"
                              : filteredStopOptions.length === 0 && stationSearch
                                ? `No stations match "${stationSearch}"`
                                : "Select a station"}
                    </MenuItem>
                    {filteredStopOptions.map((name) => (
                        <MenuItem key={name} value={name} sx={stationMenuItemSx}>
                            {name}
                        </MenuItem>
                    ))}
                </Select>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <AlertLeadMinutesField value={leadMinutes} disabled={false} onCommit={setLeadMinutes} />
                    <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
                        min before
                    </Box>
                </Box>
                <Box component="button" type="button" onClick={handleCreate} disabled={!canCreate} sx={createAlertButtonSx}>
                    {submitting ? "Creating…" : "Create"}
                </Box>
            </Box>
            {error && (
                <Typography sx={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--coral-ink)", px: 2, pb: 2 }}>
                    {error}
                </Typography>
            )}
        </Box>
    );
}

function SavedStationRow({
    station,
    onUpdate,
    onRemove,
}: {
    station: SavedStation;
    onUpdate: (patch: { alert_enabled?: boolean; alert_lead_minutes?: number }) => void;
    onRemove: () => void;
}) {
    return (
        <Box sx={rowSx}>
            <Box sx={{ flex: 1, minWidth: 160, fontFamily: "var(--font-body)", fontSize: "0.95rem", color: "var(--ink)" }}>
                {station.stop_name}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Switch
                    size="small"
                    checked={station.alert_enabled}
                    onChange={(e) => onUpdate({ alert_enabled: e.target.checked })}
                />
                <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
                    Alert
                </Box>
                <AlertLeadMinutesField
                    value={station.alert_lead_minutes}
                    disabled={!station.alert_enabled}
                    onCommit={(minutes) => onUpdate({ alert_lead_minutes: minutes })}
                />
                <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
                    min before
                </Box>
            </Box>
            <IconButton size="small" onClick={onRemove} aria-label={`Remove ${station.stop_name}`} sx={{ color: "var(--ink-secondary)" }}>
                <TrashIcon />
            </IconButton>
        </Box>
    );
}

// Phase 4 (.claude/plans/development.md): the signed-in rider's own page -
// for now just every saved station across every transit system in one
// place, grouped by system (one fetch, GET /saved_stations with no system
// param, rather than one round-trip per system the user happens to have
// saved stations in) - but named/routed as Profile, not Settings, since
// this is meant to grow into the rider's general account page over time.
export default function ProfilePage() {
    const { user } = useAuth();
    const [stations, setStations] = useState<SavedStation[]>([]);
    const [loading, setLoading] = useState(true);
    const [systems, setSystems] = useState<TransitSystem[]>([]);

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        void savedStationsApi
            .fetchAllSavedStations()
            .then((fetched) => { if (!cancelled) setStations(fetched); })
            .catch((error: unknown) => { console.error("Failed to fetch saved stations:", error); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [user]);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        void fetchTransitSystems()
            .then((fetched) => { if (!cancelled) setSystems(fetched); })
            .catch((error: unknown) => { console.error("Failed to fetch transit systems:", error); });
        return () => { cancelled = true; };
    }, [user]);

    if (!user) {
        return (
            <StatusMessage>
                <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "var(--ink-secondary)" }}>
                    Sign in to save stations and manage alerts.
                </Box>
            </StatusMessage>
        );
    }

    if (loading) {
        return (
            <StatusMessage>
                <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--ink-secondary)" }}>
                    Loading&hellip;
                </Box>
            </StatusMessage>
        );
    }

    const bySystem = new Map<string, SavedStation[]>();
    for (const station of stations) {
        const system = station.transit_system ?? "Unknown system";
        bySystem.set(system, [...(bySystem.get(system) ?? []), station]);
    }

    const handleUpdate = (
        system: string,
        stopName: string,
        patch: { alert_enabled?: boolean; alert_lead_minutes?: number },
    ) => {
        savedStationsApi
            .updateSavedStation(system, stopName, patch)
            .then((updated) => {
                // PATCH /saved_stations/{system} doesn't echo transit_system
                // back (only the all-systems GET joins it in) - merging
                // `updated` as-is would wipe it from this row, which both
                // misfiles the row under "Unknown system" on the next
                // render AND corrupts every later toggle for this row: the
                // onUpdate closure below is built from bySystem's own key,
                // so a future call would PATCH the literal, nonexistent
                // system name "Unknown system" instead of this row's real
                // one - a 404 that silently never flips the switch back.
                setStations((prev) => prev.map((s) => (
                    s.transit_system === system && s.stop_name === stopName
                        ? { ...updated, transit_system: system }
                        : s
                )));
            })
            .catch((error: unknown) => { console.error("Failed to update saved station:", error); });
    };

    const handleRemove = (system: string, stopName: string) => {
        savedStationsApi
            .unsaveStation(system, stopName)
            .then(() => {
                setStations((prev) => prev.filter((s) => !(s.transit_system === system && s.stop_name === stopName)));
            })
            .catch((error: unknown) => { console.error("Failed to remove saved station:", error); });
    };

    const handleCreate = (systemId: string, stopName: string, leadMinutes: number) => (
        savedStationsApi
            .saveStation(systemId, stopName, true, leadMinutes)
            .then((created) => {
                // POST /saved_stations/{system} doesn't echo transit_system
                // back either (see handleUpdate's own comment above for why
                // that matters) - stamped on here so the new row files under
                // the right system group instead of "Unknown system".
                setStations((prev) => [...prev, { ...created, transit_system: systemId }]);
            })
    );

    return (
        <>
            <CreateAlertBlock systems={systems} existingStations={stations} onCreate={handleCreate} />
            {stations.length === 0 ? (
                <StatusMessage>
                    <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "var(--ink-secondary)" }}>
                        No saved stations yet. Open a trip's detail and star one of its stops, or create one above.
                    </Box>
                </StatusMessage>
            ) : (
                <Box sx={{ maxWidth: 720, mx: "auto", mt: 2, backgroundColor: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)" }}>
                    {Array.from(bySystem.entries()).map(([system, systemStations]) => (
                        <Box key={system}>
                            <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem", color: "var(--ink)", px: 2, pt: 2, pb: 1 }}>
                                {system}
                            </Typography>
                            {systemStations.map((station) => (
                                <SavedStationRow
                                    key={station.stop_name}
                                    station={station}
                                    onUpdate={(patch) => handleUpdate(system, station.stop_name, patch)}
                                    onRemove={() => handleRemove(system, station.stop_name)}
                                />
                            ))}
                        </Box>
                    ))}
                </Box>
            )}
        </>
    );
}
