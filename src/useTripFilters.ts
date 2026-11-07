import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { fetchAllLines, fetchAllStops } from "./filterOptions.ts";
import type { LineSummary } from "./filterOptions.ts";
import { lineFilterValue } from "./tripUpdate.ts";
import type { StreamedUpdate } from "./tripUpdate.ts";

// Sortable columns; Line and Station are also filterable via a
// checked-value checklist.
export type SortField = "trip_headsign" | "stop_name" | "next";
export type FilterField = "trip_headsign" | "stop_name";
export type SortDirection = "asc" | "desc";
export const isFilterField = (field: SortField): field is FilterField =>
    field === "trip_headsign" || field === "stop_name";
export const COLUMN_LABELS: Record<SortField, string> = {
    trip_headsign: "Line",
    stop_name: "Station",
    next: "Next",
};

// A system's Station list in particular can run into the thousands
// (SF-MTA: ~2,200) - mounting every one of them as a MenuItem is what makes
// opening the filter menu visibly slow there, since MUI's Menu/Popover has
// to measure the whole list even though its own maxHeight only clips it
// visually. The user doesn't need to see every value immediately, so the
// checklist caps how many it renders and offers a search box instead of an
// unbounded scroll.
export const MAX_FILTER_MENU_ITEMS = 100;

// Sort/filter state persists across reloads (and across switching transit
// systems, matching this app's existing in-session behavior of not
// resetting them on system change) - not scoped per system, since the whole
// point is "come back and see the same view you left".
const FILTERS_STORAGE_KEY = "irl-transit:eventFilters";
type StoredFilters = {
    sort: { field: SortField; direction: SortDirection } | null;
    excludedValues: Record<FilterField, string[]>;
    // Optional: absent in filters stored before this field existed - see
    // clearedAll's own comment below for what it means.
    clearedAll?: Record<FilterField, boolean>;
};

// Cheap 32-bit FNV-1a hash of an already-sorted name list, joined with a
// separator no stop/line name can contain. Used below to tell "the list's
// contents changed" apart from "same length, different members" (e.g. one
// buffer-only value aging out of the live window as a different one
// appears) without diffing the full arrays on every render.
function hashOrderedNames(names: string[]): string {
    let hash = 0x811c9dc5;
    for (const ch of names.join("\u0000")) {
        hash ^= ch.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
}

// localStorage access can throw (Safari private browsing, sandboxed
// iframes, disabled storage) - persistence is a nice-to-have, not worth
// crashing over, so both directions fail soft to "no stored filters".
function readStoredFilters(): StoredFilters | null {
    try {
        const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || !("excludedValues" in parsed)) return null;
        return parsed as StoredFilters;
    } catch {
        return null;
    }
}

function writeStoredFilters(filters: StoredFilters): void {
    try {
        localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
        // Filters still work for the rest of this session.
    }
}

export type HeaderMenuState = { anchorEl: HTMLElement; field: SortField } | null;

export type TripFilters = {
    sort: { field: SortField; direction: SortDirection } | null;
    excludedValues: Record<FilterField, Set<string>>;
    distinctValues: Record<FilterField, string[]>;
    visibleMessages: StreamedUpdate[];
    headerMenu: HeaderMenuState;
    filterSearch: string;
    setFilterSearch: (value: string) => void;
    openHeaderMenu: (field: SortField) => (event: MouseEvent<HTMLElement>) => void;
    closeHeaderMenu: () => void;
    applySort: (field: SortField, direction: SortDirection) => void;
    clearSort: () => void;
    toggleFilterValue: (field: FilterField, value: string) => void;
    selectAllValues: (field: FilterField, targetValues: string[]) => void;
    clearAllValues: (field: FilterField, targetValues: string[]) => void;
    resetAllFilters: () => void;
    isColumnActive: (field: SortField) => boolean;
    anyColumnActive: boolean;
};

// Owns everything about the Line/Station/Next column headers: sort, the
// filter checklists (fetched schedule-wide via IRL-26/27's /lines, /stops
// endpoints and unioned with the live buffer), their persistence across
// reloads, and the header menu's own open/search UI state. Separated out of
// EventStreamComponent so that component only has to render what this
// returns, not manage the filter/sort state machine itself.
export function useTripFilters(systemId: string, messages: StreamedUpdate[]): TripFilters {
    const [sort, setSort] = useState<{ field: SortField; direction: SortDirection } | null>(
        () => readStoredFilters()?.sort ?? null
    );
    const [excludedValues, setExcludedValues] = useState<Record<FilterField, Set<string>>>(() => {
        const stored = readStoredFilters()?.excludedValues;
        return {
            trip_headsign: new Set(stored?.trip_headsign ?? []),
            stop_name: new Set(stored?.stop_name ?? []),
        };
    });
    // Whether the user deliberately put a column into "every value
    // excluded" state via Clear All, as opposed to excludedValues[field]
    // merely happening to contain every value distinctValues currently
    // knows about. Set only by the user actions below (clearAllValues/
    // selectAllValues/toggleFilterValue/resetAllFilters) - never re-derived
    // from comparing excludedValues against distinctValues, which is what
    // let a system switch (which transiently empties distinctValues while
    // the new system's schedule loads) get mistaken for "the user cleared
    // everything" and silently reset a real Clear All from the previous
    // system.
    const [clearedAll, setClearedAll] = useState<Record<FilterField, boolean>>(() => {
        const stored = readStoredFilters()?.clearedAll;
        return {
            trip_headsign: stored?.trip_headsign ?? false,
            stop_name: stored?.stop_name ?? false,
        };
    });
    const [headerMenu, setHeaderMenu] = useState<HeaderMenuState>(null);
    // Text typed into the filter checklist's search box - see
    // MAX_FILTER_MENU_ITEMS above. Scoped to whichever column's menu is
    // currently open; reset whenever that changes so reopening a menu (or
    // switching from Line's to Station's) doesn't start pre-filtered on
    // whatever was typed last time.
    const [filterSearch, setFilterSearch] = useState("");

    // IRL-26/IRL-27: every line/stop this system actually has, not just
    // whatever's in the live buffer right now (see distinctValues below,
    // which unions these in). Start empty rather than null - the checklist
    // just shows fewer entries until the fetch resolves, same as it always
    // has, so there's no loading state to thread through the UI for this.
    const [allLines, setAllLines] = useState<LineSummary[]>([]);
    const [allStopNames, setAllStopNames] = useState<string[]>([]);

    // Fires on system switch only - this is schedule data (changes at most
    // daily), not live data, so it has no business re-running on every SSE
    // event. Deliberately doesn't block or gate anything else: the SSE
    // connection (useTripUpdateStream) starts immediately regardless, and
    // excludedValues (the user's actual filter selections, as opposed to
    // the checklist's available options) is untouched by this fetch's state
    // or outcome either way - a slow or failed fetch just means the
    // checklist stays buffer-derived a little longer, never a reason to
    // block the system switch or discard a selection.
    useEffect(() => {
        if (!systemId) return;
        let cancelled = false;
        setAllLines([]);
        setAllStopNames([]);
        void fetchAllLines(systemId)
            .then((lines) => { if (!cancelled) setAllLines(lines); })
            .catch((error: unknown) => { if (!cancelled) console.error("Failed to load all lines:", error); });
        void fetchAllStops(systemId)
            .then((names) => { if (!cancelled) setAllStopNames(names); })
            .catch((error: unknown) => { if (!cancelled) console.error("Failed to load all stops:", error); });
        return () => { cancelled = true; };
    }, [systemId]);

    // Persist sort/filter choices every time they change, not just on
    // unmount, so a mid-session crash or closed tab doesn't lose them.
    useEffect(() => {
        writeStoredFilters({
            sort,
            excludedValues: {
                trip_headsign: Array.from(excludedValues.trip_headsign),
                stop_name: Array.from(excludedValues.stop_name),
            },
            clearedAll,
        });
    }, [sort, excludedValues, clearedAll]);

    // Distinct values for the filter checklists: the full set from
    // allLines/allStopNames once loaded, unioned with whatever's in the
    // live buffer right now (covers the window before that fetch resolves,
    // and the edge case of a live trip whose (route, headsign) pair isn't
    // in the schedule snapshot yet).
    const distinctValues: Record<FilterField, string[]> = useMemo(() => ({
        trip_headsign: Array.from(new Set([
            ...allLines.map((line) => lineFilterValue(line)),
            ...messages.map((m) => lineFilterValue(m)),
        ])).sort(),
        stop_name: Array.from(new Set([
            ...allStopNames,
            ...messages.map((m) => m.stop_name),
        ])).sort(),
    }), [messages, allLines, allStopNames]);

    // clearAllValues below snapshots the target values into excludedValues
    // at click time - fine once allLines/allStopNames have loaded, but if a
    // user hits "Clear All" in the brief window before that fetch resolves,
    // the snapshot only covers the live buffer's handful of values. Without
    // this, the schedule-wide values that appear a moment later when the
    // fetch does resolve would silently NOT be excluded, undoing what the
    // user just asked for. Keeps any field the user explicitly Cleared All
    // (see clearedAll above - never inferred from distinctValues content)
    // in sync as distinctValues changes shape, rather than freezing it at
    // whatever was known at click time. Skipped while distinctValues[field]
    // is transiently empty (a system switch resets messages/allLines before
    // the new system's fetch resolves) so that gap can't be mistaken for
    // "nothing to exclude" and wipe out the carried-over Clear All.
    // Compares a hash of the (sorted) list rather than its length - a
    // same-size swap (one buffer-only value ages out as a different one
    // appears) changes the hash even though the count doesn't, which a
    // length check alone would miss.
    const lastSyncedHashRef = useRef<Record<FilterField, string | null>>({
        trip_headsign: null,
        stop_name: null,
    });
    useEffect(() => {
        // Decide what (if anything) needs resyncing - and mutate
        // lastSyncedHashRef - here in the effect body, not inside the
        // setExcludedValues updater below: React (StrictMode, dev only)
        // double-invokes updater functions to catch impure ones, and a ref
        // mutation inside the updater is exactly that - the first
        // invocation would compute the real update, but the second sees
        // the ref already mutated to match, concludes "no change", and
        // that's the result that gets applied.
        const updates: Partial<Record<FilterField, Set<string>>> = {};
        (Object.keys(distinctValues) as FilterField[]).forEach((field) => {
            if (!clearedAll[field] || distinctValues[field].length === 0) return;
            const hash = hashOrderedNames(distinctValues[field]);
            if (hash === lastSyncedHashRef.current[field]) return;
            lastSyncedHashRef.current[field] = hash;
            updates[field] = new Set(distinctValues[field]);
        });
        if (Object.keys(updates).length === 0) return;
        setExcludedValues((prev) => ({ ...prev, ...updates }));
    }, [distinctValues, clearedAll]);

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

    const openHeaderMenu = (field: SortField) => (event: MouseEvent<HTMLElement>) => {
        setFilterSearch("");
        setHeaderMenu({ anchorEl: event.currentTarget, field });
    };
    const closeHeaderMenu = () => {
        setHeaderMenu(null);
        setFilterSearch("");
    };

    const applySort = (field: SortField, direction: SortDirection) => {
        setSort({ field, direction });
        closeHeaderMenu();
    };
    const clearSort = () => {
        setSort(null);
        closeHeaderMenu();
    };
    const toggleFilterValue = (field: FilterField, value: string) => {
        // A one-off pick is no longer "every value" even if it happens to
        // still cover all of them right now - only clearAllValues/
        // selectAllValues below (and only when acting on the full list, not
        // a search-narrowed subset - see isFullyExcluded) set this flag, so
        // a value arriving later isn't silently swept in by this instead.
        setClearedAll((prev) => ({ ...prev, [field]: false }));
        setExcludedValues((prev) => {
            const next = new Set(prev[field]);
            if (next.has(value)) next.delete(value); else next.add(value);
            return { ...prev, [field]: next };
        });
    };
    // Whether `excluded` covers every value this field currently knows
    // about - used below to decide whether a Select All/Clear All click
    // (scoped to whatever's currently search-matched, which is the full
    // list when there's no search) should set clearedAll, so e.g. clearing
    // everything via an unfiltered "Clear All" still tracks future growth
    // (see clearedAll's own comment above), while clearing only a searched
    // subset correctly does not.
    const isFullyExcluded = (field: FilterField, excluded: Set<string>) =>
        distinctValues[field].length > 0 && distinctValues[field].every((value) => excluded.has(value));
    // targetValues is whatever the menu's search box currently matches
    // (the full distinctValues[field] list when the search box is empty) -
    // not the (possibly further capped) visible slice - so e.g. searching
    // "Market" on a system with thousands of stops and clicking Clear All
    // excludes every matching stop, not just the ~100 currently rendered.
    const selectAllValues = (field: FilterField, targetValues: string[]) => {
        const next = new Set(excludedValues[field]);
        targetValues.forEach((value) => next.delete(value));
        setExcludedValues({ ...excludedValues, [field]: next });
        setClearedAll({ ...clearedAll, [field]: isFullyExcluded(field, next) });
    };
    const clearAllValues = (field: FilterField, targetValues: string[]) => {
        const next = new Set(excludedValues[field]);
        targetValues.forEach((value) => next.add(value));
        setExcludedValues({ ...excludedValues, [field]: next });
        setClearedAll({ ...clearedAll, [field]: isFullyExcluded(field, next) });
    };
    // Resets both filter columns at once - the "no results" empty state's
    // way out, as opposed to selectAllValues above which only ever touches
    // one column (the header menu's own "Select All").
    const resetAllFilters = () => {
        setClearedAll({ trip_headsign: false, stop_name: false });
        setExcludedValues({ trip_headsign: new Set(), stop_name: new Set() });
    };

    // Shared by the table headers (sm+) and the mobile toolbar buttons.
    const isColumnActive = (field: SortField) =>
        sort?.field === field || (isFilterField(field) && excludedValues[field].size > 0);
    const anyColumnActive = (["trip_headsign", "stop_name", "next"] as SortField[]).some(isColumnActive);

    return {
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
    };
}
