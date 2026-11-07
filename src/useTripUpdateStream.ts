import { useEffect, useRef, useState } from "react";
import type { StreamedUpdate, TripUpdate } from "./tripUpdate.ts";

// The server names every event, so `onmessage` (unnamed events only) never fires.
const EVENT_NAME = "trip_update";
const MAX_MESSAGES = 50;
const MAX_RETRY_DELAY_MS = 30_000;

export type TripUpdateStream = {
    messages: StreamedUpdate[];
    connected: boolean;
    // True once this system's poll cycle (30s - see the backend's
    // transit_feed()) has had a fair chance to produce at least one event.
    // A system with genuinely zero active trips right now (e.g. NY Waterway
    // overnight) never emits a single SSE event, so there's no server-side
    // "empty poll" signal to wait for instead of a timer - without this,
    // that state is indistinguishable from "still loading" and the spinner
    // never goes away. Reset on every system switch.
    settled: boolean;
};

// Owns the live SSE connection to a transit system's trip-update feed:
// connecting, reconnecting with backoff, and folding incoming events into a
// rolling buffer. Separated out of EventStreamComponent so that component
// only has to consume `{ messages, connected, settled }`, not know anything
// about EventSource/retry/backoff mechanics.
export function useTripUpdateStream(systemId: string): TripUpdateStream {
    const [messages, setMessages] = useState<StreamedUpdate[]>([]);
    const [connected, setConnected] = useState(false);
    const [settled, setSettled] = useState(false);
    // A ref, not an effect-local counter: it has to outlive reconnects and StrictMode's
    // double-mount, both of which would otherwise restart numbering into a live list.
    const seqRef = useRef(0);

    useEffect(() => {
        // Empty until the transit system list has loaded and picked a default.
        if (!systemId) return;

        // Switching systems starts a fresh window rather than mixing feeds.
        setMessages([]);
        setSettled(false);

        let eventSource: EventSource | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let attempt = 0;
        let disposed = false;

        // Longer than the backend's own 30s poll cadence plus a buffer for
        // connection/first-poll latency - see the `settled` state comment above.
        const settleTimer = setTimeout(() => setSettled(true), 35_000);

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
            clearTimeout(settleTimer);
            eventSource?.close();
        };
    }, [systemId]);

    return { messages, connected, settled };
}
