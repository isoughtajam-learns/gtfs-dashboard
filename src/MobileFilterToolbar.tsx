import { useState } from "react";
import type { MouseEvent } from "react";
import { Box } from "@mui/material";
import TransitSystemSelect from "./TransitSystemSelect.tsx";
import type { TransitSystem } from "./transitSystems.ts";
import { ChevronDownIcon, FilterIcon } from "./icons.tsx";
import { COLUMN_LABELS } from "./useTripFilters.ts";
import type { SortField } from "./useTripFilters.ts";

type MobileFilterToolbarProps = {
    systems: TransitSystem[];
    systemId: string;
    onSystemChange: (systemId: string) => void;
    isColumnActive: (field: SortField) => boolean;
    anyColumnActive: boolean;
    onOpenHeaderMenu: (field: SortField) => (event: MouseEvent<HTMLElement>) => void;
};

// Below sm: chevron toggle + transit system picker (the page header hides
// its own copy at this width) + expandable filter pills. Always visible,
// independent of whether this system currently has any data - rendered
// outside EventStreamComponent's loading/empty/table branches, so a user
// with no events yet (loading, or a system with none right now) still has
// a way to switch systems on mobile.
export default function MobileFilterToolbar({
    systems,
    systemId,
    onSystemChange,
    isColumnActive,
    anyColumnActive,
    onOpenHeaderMenu,
}: MobileFilterToolbarProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <Box sx={{ display: { xs: "block", sm: "none" }, borderBottom: "1px solid var(--hairline)" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 2, py: 1.5 }}>
                <Box
                    component="button"
                    onClick={() => setExpanded((prev) => !prev)}
                    aria-label={expanded ? "Hide column filters" : "Show column filters"}
                    aria-expanded={expanded}
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.75rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        color: anyColumnActive ? "var(--coral)" : "var(--ink-secondary)",
                        backgroundColor: "transparent",
                        border: "1px solid var(--hairline)",
                        borderRadius: "20px",
                        px: 1.25,
                        py: 0.5,
                        cursor: "pointer",
                        flexShrink: 0,
                        "& svg": {
                            transition: "transform 150ms ease",
                            transform: expanded ? "rotate(180deg)" : "none",
                        },
                    }}
                >
                    Filters
                    <ChevronDownIcon />
                </Box>
                <TransitSystemSelect
                    systems={systems}
                    selectedSystemId={systemId}
                    onSystemChange={onSystemChange}
                    sx={{ minWidth: 0 }}
                />
            </Box>
            {expanded && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, px: 2, pb: 1.5 }}>
                    {(["trip_headsign", "stop_name", "next"] as SortField[]).map((field) => (
                        <Box
                            key={field}
                            component="button"
                            onClick={onOpenHeaderMenu(field)}
                            aria-label={`Sort or filter ${COLUMN_LABELS[field]} column`}
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.75rem",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                fontWeight: 600,
                                color: isColumnActive(field) ? "var(--coral)" : "var(--ink-secondary)",
                                backgroundColor: "transparent",
                                border: "1px solid var(--hairline)",
                                borderRadius: "20px",
                                px: 1.25,
                                py: 0.5,
                                cursor: "pointer",
                            }}
                        >
                            { COLUMN_LABELS[field] }
                            <FilterIcon />
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
}
