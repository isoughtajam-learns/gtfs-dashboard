import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { Box, Checkbox, Dialog, IconButton, ListItemText, Menu, MenuItem, Typography } from "@mui/material";

// Mirrors GET /service_alerts/{transit_system}'s response shape, per
// https://github.com/isoughtajam-learns/gtfs-dashboard/issues/27#issuecomment-5614748618
type ActivePeriod = {
    start: number | null;
    end: number | null;
};
type AffectedTrip = {
    trip_id: string;
    trip_headsign: string | null;
    route_id: string | null;
};
type AffectedRoute = {
    route_id: string;
    route_short_name: string | null;
    route_long_name: string | null;
};
type ServiceAlert = {
    alert_id: string;
    cause: string;
    effect: string;
    severity_level: string | null;
    header_text: string | null;
    description_text: string | null;
    url: string | null;
    active_period: ActivePeriod[];
    affected_trips: AffectedTrip[];
    affected_routes: AffectedRoute[];
};

// "TECHNICAL_PROBLEM" -> "Technical Problem" - the raw GTFS-RT enum names
// are ugly to show verbatim.
const formatEnumLabel = (value: string) =>
    value
        .split("_")
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ");

const formatActivePeriod = (period: ActivePeriod) => {
    const start = period.start != null ? new Date(period.start * 1000).toLocaleString() : null;
    const end = period.end != null ? new Date(period.end * 1000).toLocaleString() : null;
    if (start && end) return `${start} – ${end}`;
    if (start) return `${start} onward`;
    if (end) return `Until ${end}`;
    return "Ongoing";
};
// An empty array means no declared window, which the API contract says to
// treat as "currently active" - not "no schedule info".
const formatActivePeriods = (periods: ActivePeriod[]) =>
    periods.length === 0 ? "Active now" : periods.map(formatActivePeriod).join("; ");

// Some sources prefix header_text with the same route name(s) already shown
// in the Affected Routes header (e.g. "N Judah: reroute in effect") - strip
// that lead-in so it isn't said twice.
const stripRoutesPrefix = (headerText: string, routesText: string) => {
    if (!headerText.startsWith(routesText)) return headerText;
    return headerText.slice(routesText.length).replace(/^[\s:\-–—]+/, "");
};

// Sorting/filtering operate on the live fetched list, not the raw API
// response - a few small per-alert accessors first so both can share them.

// An alert can have multiple declared windows; sorting needs one number per
// alert. Earliest start (no periods -> -Infinity, "already active" sorts
// first ascending) and latest end (no periods, or any open-ended period ->
// +Infinity, "ongoing" sorts last ascending).
const alertActiveStart = (alert: ServiceAlert): number => {
    const starts = alert.active_period.map((p) => p.start).filter((s): s is number => s != null);
    return starts.length > 0 ? Math.min(...starts) : -Infinity;
};
const alertActiveEnd = (alert: ServiceAlert): number => {
    if (alert.active_period.length === 0) return Infinity;
    const ends = alert.active_period.map((p) => p.end);
    return ends.some((e) => e == null) ? Infinity : Math.max(...(ends as number[]));
};

// Route/severity are things an alert can be filtered on. Route names reuse
// the same fallback chain as the display text; alerts with no named routes
// are bucketed under NO_ROUTES rather than excluded from filtering entirely.
const NO_ROUTES = "(No routes)";
const NO_SEVERITY = "(None)";
const alertRouteNames = (alert: ServiceAlert): string[] => {
    const names = alert.affected_routes.map((r) => r.route_short_name ?? r.route_long_name ?? r.route_id);
    return names.length > 0 ? names : [NO_ROUTES];
};
const alertSeverityLabel = (alert: ServiceAlert) =>
    alert.severity_level ? formatEnumLabel(alert.severity_level) : NO_SEVERITY;

// One pill per item, left to right: Start/End are sort-only, Severity/Route
// are filter-only - matching EventStreamComponent.tsx's one-pill-per-column
// pattern, just with four items instead of three.
type AlertSortField = "active_start" | "active_end";
type AlertSortDirection = "asc" | "desc";
type AlertFilterField = "severity" | "route";
type AlertField = AlertSortField | AlertFilterField;
const isAlertFilterField = (field: AlertField): field is AlertFilterField =>
    field === "severity" || field === "route";
const ALERT_FIELD_ORDER: AlertField[] = ["active_start", "active_end", "severity", "route"];
const ALERT_FIELD_LABELS: Record<AlertField, string> = {
    active_start: "Start",
    active_end: "End",
    severity: "Severity",
    route: "Routes",
};

// Classic three-line funnel, same glyph as EventStreamComponent.tsx's column
// filters - active state (something sorted or filtered) is conveyed by the
// IconButton's own color, not the glyph.
function FilterIcon() {
    return (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
            <line x1="1" y1="1" x2="11" y2="1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="2.5" y1="5" x2="9.5" y2="5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="4.5" y1="9" x2="7.5" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

// Discriminated on the response's meaning, not just its HTTP status: 404 and
// 502 both get soft, non-alarming treatment per the endpoint's own guidance
// (404 = "no alerts feature for this system", 502 = "transient, safe to
// retry" - neither is a real error to scare the user with).
type FetchStatus =
    | { kind: "loading" }
    | { kind: "unavailable" }
    | { kind: "transient" }
    | { kind: "error"; message: string }
    | { kind: "ready"; alerts: ServiceAlert[] };

const alertHeaderLabelSx = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.7rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    fontWeight: 600,
    color: "var(--ink-secondary)",
};
// The alert's actual message: what a reader is here for, so it gets the
// most visual weight in the card.
const alertTitleSx = {
    fontFamily: "var(--font-body)",
    fontSize: "1.05rem",
    fontWeight: 700,
    color: "var(--coral)",
};
const alertBodyTextSx = {
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    lineHeight: 1.6,
    color: "var(--ink)",
};
// Incidental metadata (Active window, Alert ID) - deliberately smaller and
// dimmer than the body text above, so it reads as a footnote rather than
// competing with the alert's actual message for attention.
const alertMetaTextSx = {
    fontFamily: "var(--font-body)",
    fontSize: "0.75rem",
    color: "var(--ink-secondary)",
};

const sortFilterMenuPaperSx = {
    backgroundColor: "var(--surface-raised)",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius)",
    color: "var(--ink)",
    maxHeight: 420,
};
const sortFilterMenuItemSx = {
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    justifyContent: "flex-start",
    minHeight: "auto",
    "&:hover": { backgroundColor: "color-mix(in srgb, var(--coral) 16%, transparent)" },
};
const sortFilterCheckboxItemSx = { ...sortFilterMenuItemSx, py: 0.25, pl: 0.5 };
const sortFilterCheckboxSx = {
    color: "var(--ink-secondary)",
    p: 0.5,
    "&.Mui-checked": { color: "var(--coral)" },
};

function CloseIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

function HeaderField({ label, value }: { label: string; value: string }) {
    return (
        <Box>
            <Box sx={alertHeaderLabelSx}>{ label }</Box>
            <Box sx={alertBodyTextSx}>{ value }</Box>
        </Box>
    );
}

function AlertCard({ alert }: { alert: ServiceAlert }) {
    const routeNames = alert.affected_routes.map((r) => r.route_short_name ?? r.route_long_name ?? r.route_id);
    const tripNames = alert.affected_trips.map((t) => t.trip_headsign ?? t.trip_id);
    const activeText = formatActivePeriods(alert.active_period);
    const routesText = routeNames.length > 0 ? routeNames.join(", ") : "—";
    const headerText = alert.header_text && routeNames.length > 0
        ? stripRoutesPrefix(alert.header_text, routesText)
        : alert.header_text;
    // Cleaned the same way as headerText - otherwise the dedup check below
    // could compare a stripped header against an unstripped description
    // that would've matched too, and both would render.
    const descriptionText = alert.description_text && routeNames.length > 0
        ? stripRoutesPrefix(alert.description_text, routesText)
        : alert.description_text;

    return (
        <Box
            sx={{
                border: "1px solid var(--hairline)",
                borderRadius: "var(--radius)",
                backgroundColor: "var(--surface)",
                p: 2,
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: { xs: 0, sm: 3 },
            }}
        >
            {/* Left header area: Cause/Effect/Severity, fixed width so
                cards line up. Unchanged between xs (horizontal row) and
                sm+ (vertical column). */}
            <Box
                sx={{
                    display: "flex",
                    flexDirection: { xs: "row", sm: "column" },
                    flexWrap: { xs: "wrap", sm: "nowrap" },
                    gap: { xs: 3, sm: 1.5 },
                    pb: { xs: 1.5, sm: 0 },
                    mb: { xs: 1.5, sm: 0 },
                    pr: { xs: 0, sm: 3 },
                    borderBottom: { xs: "1px solid var(--hairline)", sm: "none" },
                    borderRight: { xs: "none", sm: "1px solid var(--hairline)" },
                    flexShrink: 0,
                    width: { sm: 180 },
                }}
            >
                <HeaderField label="Cause" value={formatEnumLabel(alert.cause)} />
                <HeaderField label="Effect" value={formatEnumLabel(alert.effect)} />
                <HeaderField label="Severity" value={alert.severity_level ? formatEnumLabel(alert.severity_level) : "—"} />
            </Box>

            {/* Right side: the bulk of the card on sm+ (flex:1 against the
                left area's fixed width). Affected Routes is plain body
                text under the message, same on every screen size now -
                Active moved out of this area entirely; it now lives in the
                metadata footer at the bottom, alongside Alert ID. */}
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    { headerText && <Box sx={alertTitleSx}>{ headerText }</Box> }
                    { descriptionText && headerText !== descriptionText && (
                        <Box sx={alertBodyTextSx}>{ descriptionText }</Box>
                    )}
                    { alert.url && (
                        <Box
                            component="a"
                            href={alert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={alertBodyTextSx}
                        >
                            { alert.url }
                        </Box>
                    )}
                    { routeNames.length > 0 && (
                        <Box sx={alertBodyTextSx}>Affected routes: { routesText }</Box>
                    )}
                    { tripNames.length > 0 && (
                        <Box sx={{ ...alertBodyTextSx, color: "var(--ink-secondary)" }}>Affected trips: { tripNames.join(", ") }</Box>
                    )}
                </Box>
                {/* Metadata footer - same de-emphasized treatment for both
                    lines, and Active lives here (not up top) on every
                    screen size now, not just xs. */}
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 0.25 }}>
                    <Box sx={alertMetaTextSx}>Active: { activeText }</Box>
                    <Box sx={alertMetaTextSx}>Alert ID: { alert.alert_id }</Box>
                </Box>
            </Box>
        </Box>
    );
}

type ServiceAlertsModalProps = {
    systemId: string;
    systemLabel?: string;
    open: boolean;
    onClose: () => void;
};

export default function ServiceAlertsModal({ systemId, systemLabel, open, onClose }: ServiceAlertsModalProps) {
    const [status, setStatus] = useState<FetchStatus>({ kind: "loading" });

    // Fires the fetch each time the modal opens (per the ask: opening the
    // modal is what triggers it), not on a background interval - the
    // endpoint's own polling guidance is about clients that poll
    // continuously, which this simple on-open fetch isn't.
    useEffect(() => {
        if (!open || !systemId) return;

        let cancelled = false;
        setStatus({ kind: "loading" });

        fetch(`/api/service_alerts/${systemId}`)
            .then(async (res) => {
                if (res.status === 404) {
                    if (!cancelled) setStatus({ kind: "unavailable" });
                    return;
                }
                if (res.status === 502) {
                    if (!cancelled) setStatus({ kind: "transient" });
                    return;
                }
                if (!res.ok) throw new Error(`Failed to fetch service alerts: ${res.status}`);
                const alerts: ServiceAlert[] = await res.json();
                if (!cancelled) setStatus({ kind: "ready", alerts });
            })
            .catch((err: Error) => {
                if (!cancelled) setStatus({ kind: "error", message: err.message });
            });

        return () => { cancelled = true; };
    }, [open, systemId]);

    // Sort/filter apply to whatever's currently fetched - no server-side
    // support for either, so both happen client-side over the ready list.
    const [sort, setSort] = useState<{ field: AlertSortField; direction: AlertSortDirection } | null>(null);
    const [excludedValues, setExcludedValues] = useState<Record<AlertFilterField, Set<string>>>({
        severity: new Set(),
        route: new Set(),
    });
    // One menu shared across all four pills, keyed on which pill opened it -
    // same pattern as EventStreamComponent.tsx's headerMenu.
    const [fieldMenu, setFieldMenu] = useState<{ anchorEl: HTMLElement; field: AlertField } | null>(null);

    // Memoized (not just derived inline) so it's referentially stable across
    // renders where status hasn't changed - otherwise every render below
    // would see a "new" empty array and invalidate their own memoization.
    const alerts = useMemo(() => (status.kind === "ready" ? status.alerts : []), [status]);

    const distinctValues: Record<AlertFilterField, string[]> = useMemo(() => ({
        severity: Array.from(new Set(alerts.map(alertSeverityLabel))).sort(),
        route: Array.from(new Set(alerts.flatMap(alertRouteNames))).sort(),
    }), [alerts]);

    const visibleAlerts = useMemo(() => {
        const filtered = alerts.filter((alert) => {
            if (excludedValues.severity.has(alertSeverityLabel(alert))) return false;
            // Excluded only if EVERY one of the alert's routes is excluded -
            // an alert naming several routes should still show as long as
            // at least one of them is still checked.
            if (alertRouteNames(alert).every((name) => excludedValues.route.has(name))) return false;
            return true;
        });
        if (!sort) return filtered;
        const sorted = [...filtered].sort((a, b) => {
            const cmp = sort.field === "active_start"
                ? alertActiveStart(a) - alertActiveStart(b)
                : alertActiveEnd(a) - alertActiveEnd(b);
            return sort.direction === "asc" ? cmp : -cmp;
        });
        return sorted;
    }, [alerts, excludedValues, sort]);

    const isFieldActive = (field: AlertField) =>
        isAlertFilterField(field) ? excludedValues[field].size > 0 : sort?.field === field;

    const openFieldMenu = (field: AlertField) => (event: MouseEvent<HTMLElement>) =>
        setFieldMenu({ anchorEl: event.currentTarget, field });
    const closeFieldMenu = () => setFieldMenu(null);

    const applySort = (field: AlertSortField, direction: AlertSortDirection) => {
        setSort({ field, direction });
        closeFieldMenu();
    };
    const clearSort = () => {
        setSort(null);
        closeFieldMenu();
    };
    const toggleFilterValue = (field: AlertFilterField, value: string) => {
        setExcludedValues((prev) => {
            const next = new Set(prev[field]);
            if (next.has(value)) next.delete(value); else next.add(value);
            return { ...prev, [field]: next };
        });
    };
    const selectAllValues = (field: AlertFilterField) =>
        setExcludedValues((prev) => ({ ...prev, [field]: new Set() }));
    const clearAllValues = (field: AlertFilterField) =>
        setExcludedValues((prev) => ({ ...prev, [field]: new Set(distinctValues[field]) }));

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth={false}
            slotProps={{
                paper: {
                    sx: {
                        width: "88vw",
                        height: "88vh",
                        maxWidth: "88vw",
                        maxHeight: "88vh",
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        backgroundColor: "var(--surface-raised)",
                        border: "1px solid var(--hairline)",
                        borderRadius: "var(--radius)",
                        color: "var(--ink)",
                        boxShadow: "none",
                    },
                },
            }}
        >
            <Box
                sx={{
                    position: "relative",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    pr: { xs: 6, sm: 2 },
                    borderBottom: "1px solid var(--hairline)",
                    flexShrink: 0,
                }}
            >
                <Typography sx={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "1.5rem", textAlign: "left", minWidth: 0 }}>
                    Service Alerts{ systemLabel ? ` — ${systemLabel}` : "" }
                </Typography>
                <IconButton
                    onClick={onClose}
                    aria-label="Close service alerts"
                    sx={{
                        color: "var(--coral)",
                        position: { xs: "absolute", sm: "static" },
                        top: { xs: 8, sm: "auto" },
                        right: { xs: 8, sm: "auto" },
                        flexShrink: 0,
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>
            { status.kind === "ready" && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, px: 2, py: 1, borderBottom: "1px solid var(--hairline)", flexShrink: 0 }}>
                    { ALERT_FIELD_ORDER.map((field) => (
                        <Box
                            key={field}
                            component="button"
                            onClick={openFieldMenu(field)}
                            aria-label={`${isAlertFilterField(field) ? "Filter" : "Sort"} by ${ALERT_FIELD_LABELS[field]}`}
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.75rem",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                fontWeight: 600,
                                color: isFieldActive(field) ? "var(--coral)" : "var(--ink-secondary)",
                                backgroundColor: "transparent",
                                border: "1px solid var(--hairline)",
                                borderRadius: "20px",
                                px: 1.25,
                                py: 0.5,
                                cursor: "pointer",
                            }}
                        >
                            { ALERT_FIELD_LABELS[field] }
                            <FilterIcon />
                        </Box>
                    ))}
                </Box>
            )}
            <Box sx={{ flex: 1, overflow: "auto", p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                { status.kind === "loading" && (
                    <Typography sx={{ fontFamily: "var(--font-body)", color: "var(--ink-secondary)" }}>
                        Loading&hellip;
                    </Typography>
                )}
                { status.kind === "unavailable" && (
                    <Typography sx={{ fontFamily: "var(--font-body)", color: "var(--ink-secondary)" }}>
                        Service alerts aren&rsquo;t available for this system yet.
                    </Typography>
                )}
                { status.kind === "transient" && (
                    <Typography sx={{ fontFamily: "var(--font-body)", color: "var(--ink-secondary)" }}>
                        Couldn&rsquo;t reach the alerts source right now &mdash; try again shortly.
                    </Typography>
                )}
                { status.kind === "error" && (
                    <Typography sx={{ fontFamily: "var(--font-body)", color: "var(--coral-ink)" }}>
                        { status.message }
                    </Typography>
                )}
                { status.kind === "ready" && status.alerts.length === 0 && (
                    <Typography sx={{ fontFamily: "var(--font-body)", color: "var(--ink-secondary)" }}>
                        No active alerts{ systemLabel ? ` for ${systemLabel}` : "" }.
                    </Typography>
                )}
                { status.kind === "ready" && status.alerts.length > 0 && visibleAlerts.length === 0 && (
                    <Typography sx={{ fontFamily: "var(--font-body)", color: "var(--ink-secondary)" }}>
                        No alerts match the current filters.
                    </Typography>
                )}
                { status.kind === "ready" && visibleAlerts.map((alert) => (
                    <AlertCard key={alert.alert_id} alert={alert} />
                ))}
            </Box>
            <Menu
                anchorEl={fieldMenu?.anchorEl ?? null}
                open={Boolean(fieldMenu)}
                onClose={closeFieldMenu}
                slotProps={{ paper: { sx: sortFilterMenuPaperSx } }}
            >
                {fieldMenu && [
                    ...(!isAlertFilterField(fieldMenu.field)
                        ? [
                            <MenuItem key="asc" onClick={() => applySort(fieldMenu.field as AlertSortField, "asc")} sx={sortFilterMenuItemSx}>
                                Sort Ascending
                            </MenuItem>,
                            <MenuItem key="desc" onClick={() => applySort(fieldMenu.field as AlertSortField, "desc")} sx={sortFilterMenuItemSx}>
                                Sort Descending
                            </MenuItem>,
                            ...(sort?.field === fieldMenu.field
                                ? [<MenuItem key="clear-sort" onClick={clearSort} sx={sortFilterMenuItemSx}>Clear Sort</MenuItem>]
                                : []),
                        ]
                        : []),
                    ...(isAlertFilterField(fieldMenu.field)
                        ? [
                            <MenuItem key="select-all" onClick={() => selectAllValues(fieldMenu.field as AlertFilterField)} sx={sortFilterMenuItemSx}>
                                Select All
                            </MenuItem>,
                            <MenuItem key="clear-all" onClick={() => clearAllValues(fieldMenu.field as AlertFilterField)} sx={sortFilterMenuItemSx}>
                                Clear All
                            </MenuItem>,
                            ...distinctValues[fieldMenu.field as AlertFilterField].map((value) => (
                                <MenuItem
                                    key={`value-${value}`}
                                    onClick={() => toggleFilterValue(fieldMenu.field as AlertFilterField, value)}
                                    sx={sortFilterCheckboxItemSx}
                                >
                                    <Checkbox
                                        size="small"
                                        checked={!excludedValues[fieldMenu.field as AlertFilterField].has(value)}
                                        sx={sortFilterCheckboxSx}
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
        </Dialog>
    );
}
