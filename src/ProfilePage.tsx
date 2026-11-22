import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { Box, IconButton, Switch, Typography } from "@mui/material";
import { useAuth } from "./AuthContext.tsx";
import * as savedStationsApi from "./savedStations.ts";
import type { SavedStation } from "./savedStations.ts";
import { StatusMessage } from "./StatusMessage.tsx";

function TrashIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.6 9.5a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
const LEAD_MINUTES_OPTIONS = Array.from(
    { length: LEAD_MINUTES_MAX - LEAD_MINUTES_MIN + 1 },
    (_, index) => LEAD_MINUTES_MIN + index,
);

// Clamps an in-range number, rounds a fractional one - returns null only
// for text that isn't a number at all (empty, letters, ...), which the
// caller falls back to reverting rather than guessing at.
function clampLeadMinutes(raw: string): number | null {
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return Math.min(LEAD_MINUTES_MAX, Math.max(LEAD_MINUTES_MIN, Math.round(value)));
}

// sm and up: a plain text field, not a number spinner - a number input's
// up/down arrows are the only reliable way to change it, since every
// keystroke was previously validated and clamped immediately, which
// silently rejected the in-between state of clearing the first digit to
// retype it. This only validates once, on blur/Enter, so an in-progress
// edit is never fought mid-keystroke. Below sm, a dropdown over the
// allowed range instead - no text entry to fight with on a touch keyboard.
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
            <Box
                component="select"
                disabled={disabled}
                value={value}
                onChange={(e) => onCommit(Number(e.target.value))}
                sx={{ ...leadMinutesFieldSx, width: 64, display: { xs: "inline-block", sm: "none" } }}
            >
                {LEAD_MINUTES_OPTIONS.map((minute) => (
                    <option key={minute} value={minute}>{minute}</option>
                ))}
            </Box>
        </>
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

    if (stations.length === 0) {
        return (
            <StatusMessage>
                <Box sx={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "var(--ink-secondary)" }}>
                    No saved stations yet. Open a trip's detail and star one of its stops to save it here.
                </Box>
            </StatusMessage>
        );
    }

    return (
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
    );
}
