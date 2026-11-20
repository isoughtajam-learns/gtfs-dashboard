import { useEffect, useState } from "react";
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
                <Box
                    component="input"
                    type="number"
                    min={1}
                    max={60}
                    disabled={!station.alert_enabled}
                    value={station.alert_lead_minutes}
                    onChange={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value) && value >= 1 && value <= 60) {
                            onUpdate({ alert_lead_minutes: value });
                        }
                    }}
                    sx={leadMinutesFieldSx}
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

// Phase 4 (.claude/plans/development.md): every saved station across every
// transit system in one place, grouped by system - one fetch
// (GET /saved_stations, no system param) rather than one round-trip per
// system the user happens to have saved stations in.
export default function SettingsPage() {
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
                    No saved stations yet. Star a station from the live feed to save it here.
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
