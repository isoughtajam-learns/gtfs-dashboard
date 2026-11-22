import type { MouseEvent } from "react";
import { Box, Checkbox, IconButton, ListItemText, Menu, MenuItem } from "@mui/material";
import { FilterIcon } from "./icons.tsx";
import { COLUMN_LABELS, MAX_FILTER_MENU_ITEMS, isFilterField } from "./useTripFilters.ts";
import type { FilterField, HeaderMenuState, SortDirection, SortField } from "./useTripFilters.ts";

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

type SortFilterIconButtonProps = {
    label: string;
    active: boolean;
    onClick: (event: MouseEvent<HTMLElement>) => void;
};

// The small filter-funnel IconButton next to each sortable/filterable
// column header (Line/Station/Next) - active state (accent color) is
// conveyed by the IconButton's own color, not the glyph.
export function SortFilterIconButton({ label, active, onClick }: SortFilterIconButtonProps) {
    return (
        <IconButton
            size="small"
            onClick={onClick}
            aria-label={label}
            sx={{
                color: active ? "var(--coral)" : "inherit",
                p: 0.25,
                ml: 0.5,
                verticalAlign: "middle",
            }}
        >
            <FilterIcon />
        </IconButton>
    );
}

type FilterHeaderMenuProps = {
    headerMenu: HeaderMenuState;
    onClose: () => void;
    sort: { field: SortField; direction: SortDirection } | null;
    distinctValues: Record<FilterField, string[]>;
    excludedValues: Record<FilterField, Set<string>>;
    filterSearch: string;
    onFilterSearchChange: (value: string) => void;
    onApplySort: (field: SortField, direction: SortDirection) => void;
    onClearSort: () => void;
    onToggleValue: (field: FilterField, value: string) => void;
    onSelectAll: (field: FilterField, targetValues: string[]) => void;
    onClearAll: (field: FilterField, targetValues: string[]) => void;
};

// The Line/Station/Next column header's dropdown: sort options for Next,
// and for Line/Station a filter checklist (search box + Select/Clear All +
// a capped, searchable value list - see MAX_FILTER_MENU_ITEMS).
export function FilterHeaderMenu({
    headerMenu,
    onClose,
    sort,
    distinctValues,
    excludedValues,
    filterSearch,
    onFilterSearchChange,
    onApplySort,
    onClearSort,
    onToggleValue,
    onSelectAll,
    onClearAll,
}: FilterHeaderMenuProps) {
    return (
        <Menu
            anchorEl={headerMenu?.anchorEl ?? null}
            open={Boolean(headerMenu)}
            onClose={onClose}
            slotProps={{ paper: { sx: menuPaperSx } }}
        >
            {headerMenu && [
                // Line/Station are filter-only now (no Sort Ascending/
                // Descending) - only Next, which has no filter, still
                // gets sort options.
                ...(!isFilterField(headerMenu.field)
                    ? [
                        <MenuItem key="asc" onClick={() => onApplySort(headerMenu.field, "asc")} sx={menuItemSx}>
                            Sort Ascending
                        </MenuItem>,
                        <MenuItem key="desc" onClick={() => onApplySort(headerMenu.field, "desc")} sx={menuItemSx}>
                            Sort Descending
                        </MenuItem>,
                        ...(sort?.field === headerMenu.field
                            ? [<MenuItem key="clear-sort" onClick={onClearSort} sx={menuItemSx}>Clear Sort</MenuItem>]
                            : []),
                    ]
                    : []),
                ...(isFilterField(headerMenu.field)
                    ? (() => {
                        const field = headerMenu.field as FilterField;
                        const matches = filterSearch
                            ? distinctValues[field].filter((value) =>
                                value.toLowerCase().includes(filterSearch.toLowerCase()))
                            : distinctValues[field];
                        const visible = matches.slice(0, MAX_FILTER_MENU_ITEMS);
                        const hiddenCount = matches.length - visible.length;
                        // Select All/Clear All act on `matches` - the full
                        // search-matched set, not `visible` (which is further
                        // capped for rendering) - so e.g. searching "Market"
                        // and clicking Clear All excludes every matching stop,
                        // not just the ~100 currently rendered. Label reflects
                        // that scope whenever a search is active, rather than
                        // reading as "everything" when it isn't.
                        const scoped = filterSearch.length > 0;
                        return [
                            // Plain <li> rather than a MenuItem - this is a text
                            // input, not a selectable option, and stopping
                            // keydown propagation (besides Escape, which must
                            // still reach the Menu to close it) keeps MenuList's
                            // own letter-key typeahead from hijacking what's
                            // typed here.
                            <Box
                                key="search"
                                component="li"
                                onKeyDown={(e) => { if (e.key !== "Escape") e.stopPropagation(); }}
                                sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.5, py: 0.75, listStyle: "none" }}
                            >
                                <Box
                                    component="input"
                                    autoFocus
                                    value={filterSearch}
                                    onChange={(e) => onFilterSearchChange(e.target.value)}
                                    placeholder={`Search ${COLUMN_LABELS[field]}…`}
                                    sx={{
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
                                    }}
                                />
                                {scoped && (
                                    <Box
                                        component="button"
                                        type="button"
                                        onClick={() => onFilterSearchChange("")}
                                        aria-label={`Clear ${COLUMN_LABELS[field]} search`}
                                        sx={{
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
                                        }}
                                    >
                                        &times;
                                    </Box>
                                )}
                            </Box>,
                            <MenuItem key="select-all" onClick={() => onSelectAll(field, matches)} sx={menuItemSx}>
                                { scoped ? "Select All Matching" : "Select All" }
                            </MenuItem>,
                            <MenuItem key="clear-all" onClick={() => onClearAll(field, matches)} sx={menuItemSx}>
                                { scoped ? "Clear All Matching" : "Clear All" }
                            </MenuItem>,
                            ...visible.map((value) => (
                                <MenuItem
                                    key={`value-${value}`}
                                    onClick={() => onToggleValue(field, value)}
                                    sx={checkboxItemSx}
                                >
                                    <Checkbox
                                        size="small"
                                        checked={!excludedValues[field].has(value)}
                                        sx={checkboxSx}
                                        tabIndex={-1}
                                        disableRipple
                                    />
                                    <ListItemText primary={value} />
                                </MenuItem>
                            )),
                            ...(hiddenCount > 0
                                ? [
                                    <Box
                                        key="more-hint"
                                        component="li"
                                        sx={{
                                            px: 1.5,
                                            py: 0.75,
                                            listStyle: "none",
                                            fontFamily: "var(--font-body)",
                                            fontSize: "0.75rem",
                                            color: "var(--ink-secondary)",
                                        }}
                                    >
                                        +{hiddenCount} more - refine your search to see them
                                    </Box>,
                                ]
                                : []),
                        ];
                    })()
                    : []),
            ]}
        </Menu>
    );
}
