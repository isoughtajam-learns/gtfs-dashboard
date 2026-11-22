import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import * as savedStationsApi from "./savedStations.ts";
import type { SavedStation } from "./savedStations.ts";

export type SavedStationsState = {
    saved: SavedStation[];
    savedStopNames: Set<string>;
    loading: boolean;
    // True once BOTH auth and this system's own saved-stations fetch have
    // resolved at least once - see `loading`'s own comment above for why
    // `loading` alone (starting true) is what makes this accurate.
    ready: boolean;
    save: (stopName: string) => Promise<void>;
    unsave: (stopName: string) => Promise<void>;
    updateAlert: (
        stopName: string,
        patch: { alert_enabled?: boolean; alert_lead_minutes?: number },
    ) => Promise<void>;
};

// Phase 4 (.claude/plans/development.md): one transit system's saved
// stations for the current user. Empty/no-op while logged out - every
// mutator below is a thin wrapper that's simply never wired to a control
// a logged-out viewer can reach (TripDetailCard only renders the
// save/unsave star when useAuth().user is set).
export function useSavedStations(systemId: string): SavedStationsState {
    const { user, loading: authLoading } = useAuth();
    const [saved, setSaved] = useState<SavedStation[]>([]);
    // Starts true, not false - `ready` below (!authLoading && !loading)
    // depends on this only ever reading false once a real resolution has
    // happened (the no-op branch below included), never merely because no
    // effect has run yet. Confirmed live: initializing this to false let
    // the saved-stations default in useTripFilters fire its one-time
    // decision before this hook's own first fetch had even started,
    // seeing a transiently-empty `saved` and permanently skipping the
    // seed for a real user who did have saved stations.
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(() => {
        // Wait for auth itself to resolve before deciding anything - while
        // it's still hydrating, `user` is indistinguishable from "really
        // logged out," and resolving `loading` to false here would do the
        // same premature-ready thing this comment is already guarding
        // against, one level up.
        if (authLoading) return;
        if (!systemId || !user) {
            setSaved([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        void savedStationsApi
            .fetchSavedStations(systemId)
            .then(setSaved)
            .catch((error: unknown) => { console.error("Failed to fetch saved stations:", error); })
            .finally(() => setLoading(false));
    }, [systemId, user, authLoading]);

    useEffect(() => { refetch(); }, [refetch]);

    const savedStopNames = useMemo(() => new Set(saved.map((s) => s.stop_name)), [saved]);

    const save = useCallback(async (stopName: string) => {
        if (!systemId) return;
        const created = await savedStationsApi.saveStation(systemId, stopName);
        setSaved((prev) => [...prev, created]);
    }, [systemId]);

    const unsave = useCallback(async (stopName: string) => {
        if (!systemId) return;
        await savedStationsApi.unsaveStation(systemId, stopName);
        setSaved((prev) => prev.filter((s) => s.stop_name !== stopName));
    }, [systemId]);

    const updateAlert = useCallback(async (
        stopName: string,
        patch: { alert_enabled?: boolean; alert_lead_minutes?: number },
    ) => {
        if (!systemId) return;
        const updated = await savedStationsApi.updateSavedStation(systemId, stopName, patch);
        setSaved((prev) => prev.map((s) => (s.stop_name === stopName ? updated : s)));
    }, [systemId]);

    return {
        saved,
        savedStopNames,
        loading,
        ready: !authLoading && !loading,
        save,
        unsave,
        updateAlert,
    };
}
