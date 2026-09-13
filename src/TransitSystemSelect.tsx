import { MenuItem, Select } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { TransitSystem } from "./transitSystems.ts";

// --surface-raised with a hairline divider, no elevation shadow - matches
// the flat treatment used everywhere else.
const menuPaperSx = {
    backgroundColor: "var(--surface-raised)",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius)",
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
};
const menuItemSx = {
    fontFamily: "var(--font-display)",
    justifyContent: "flex-end",
    "&:hover": { backgroundColor: "color-mix(in srgb, var(--coral) 16%, transparent)" },
    "&.Mui-selected": {
        backgroundColor: "color-mix(in srgb, var(--coral) 22%, transparent)",
        "&:hover": { backgroundColor: "color-mix(in srgb, var(--coral) 28%, transparent)" },
    },
};

type TransitSystemSelectProps = {
    systems: TransitSystem[];
    selectedSystemId: string;
    onSystemChange: (systemId: string) => void;
    sx?: SxProps<Theme>;
};

// Shared by the page header (sm+) and the mobile event-feed toolbar (xs, in
// place of the header's copy - see Header.tsx) so the two pickers can't
// visually drift apart.
export default function TransitSystemSelect({ systems, selectedSystemId, onSystemChange, sx }: TransitSystemSelectProps) {
    const handleChange = (event: SelectChangeEvent) => onSystemChange(event.target.value);

    return (
        <Select
            value={selectedSystemId}
            onChange={handleChange}
            size="small"
            variant="standard"
            disableUnderline
            inputProps={{ "aria-label": "Transit system" }}
            MenuProps={{ slotProps: { paper: { sx: menuPaperSx } } }}
            sx={[
                {
                    color: "var(--ink)",
                    fontFamily: "var(--font-display)",
                    // Same recipe as the table's status pill background - a
                    // shrink-to-fit pill rather than a fixed-width box, so
                    // the arrow sits right after the name instead of pinned
                    // to a far-right edge. Root becomes a flex row
                    // (select-value + icon) so the icon, taken out of MUI's
                    // default absolute positioning below, lands inline
                    // right after the text and centers on the row via
                    // alignItems.
                    display: "inline-flex",
                    alignItems: "center",
                    backgroundColor: "color-mix(in srgb, var(--ink-secondary) 20%, transparent)",
                    // Matches the Line column's headsign chip shape
                    // (EventStreamComponent's HeadsignChip), not a full pill.
                    borderRadius: "6px",
                    "& .MuiSelect-icon": { color: "var(--coral)", position: "static", marginRight: "10px" },
                    "& .MuiSelect-select": {
                        textAlign: "left",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        py: "4px !important",
                        pl: "12px !important",
                        pr: "4px !important",
                    },
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        >
            {systems.map((system) => (
                <MenuItem key={system.id} value={system.id} sx={menuItemSx}>
                    {system.label}
                </MenuItem>
            ))}
        </Select>
    );
}
