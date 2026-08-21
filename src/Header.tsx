import { useState } from 'react';
import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { SelectChangeEvent } from "@mui/material";
import { AppBar, Box, IconButton, Menu, MenuItem, Select, Toolbar, Typography } from "@mui/material";
import SplitFlapTitle from "./SplitFlapTitle.tsx";
import type { TransitSystem } from "./transitSystems.ts";

// No @mui/icons-material dependency in this project; three bars is all a hamburger needs.
function MenuIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

// Pages this menu can navigate to. Add entries here as more pages land.
const PAGES: { path: string; label: string }[] = [
    { path: "/", label: "Live" },
    { path: "/about", label: "About" },
];

type HeaderProps = {
    systems: TransitSystem[];
    selectedSystemId: string;
    onSystemChange: (systemId: string) => void;
};

export default function Header({ systems, selectedSystemId, onSystemChange }: HeaderProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const menuOpen = Boolean(anchorEl);
    const location = useLocation();
    const navigate = useNavigate();

    const handleMenuOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handleSystemChange = (event: SelectChangeEvent) => onSystemChange(event.target.value);

    // Bahnhof design system (bahnhof-design-spec.md) - a raised surface
    // (--bg-elev) with a hairline divider, matching the flat, square-cornered
    // treatment used everywhere else (no elevation shadow).
    const menuPaperSx = {
        backgroundColor: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        color: "var(--ink)",
        fontFamily: "var(--font-display)",
    };
    const menuItemSx = {
        fontFamily: "var(--font-display)",
        // MenuItem is a flex container, so justifyContent (not textAlign)
        // is what right-aligns the label - shared by the transit-system
        // dropdown and the hamburger page menu.
        justifyContent: "flex-end",
        "&:hover": { backgroundColor: "color-mix(in srgb, var(--brass) 16%, transparent)" },
        "&.Mui-selected": {
            backgroundColor: "color-mix(in srgb, var(--brass) 22%, transparent)",
            "&:hover": { backgroundColor: "color-mix(in srgb, var(--brass) 28%, transparent)" },
        },
    };

    return (
        <AppBar
            position="static"
            elevation={0}
            sx={{
                backgroundColor: "var(--bg-elev)",
                borderBottom: "1px solid var(--line)",
                color: "var(--ink)",
            }}
        >
            <Toolbar sx={{ gap: { xs: 1, sm: 2 } }}>
                <Box
                    component={Link}
                    to="/"
                    aria-label="IRL Transit home"
                    sx={{ display: "flex", alignItems: "center", flexShrink: 0, color: "inherit", textDecoration: "none" }}
                >
                    <Typography
                        variant="h6"
                        component="span"
                        sx={{ textAlign: "left", fontWeight: 700, fontSize: { xs: "1.05rem", sm: "1.3rem" } }}
                    >
                        <SplitFlapTitle
                            textA="IRL Transit"
                            textB="[real-time transit info]"
                            fontFamilyA="var(--font-display)"
                            fontFamilyB="var(--font-body)"
                            colorA="var(--brass)"
                            colorB="var(--ink-dim)"
                        />
                    </Typography>
                </Box>
                {/* Non-interactive filler - absorbs the remaining space so
                    the link above stays sized to the title text instead of
                    stretching (and being clickable) across the whole header. */}
                <Box sx={{ flexGrow: 1 }} />
                <Typography
                    component="span"
                    aria-label={`version ${__APP_VERSION__}`}
                    sx={{
                        display: { xs: "none", sm: "inline" },
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.65625rem",
                        letterSpacing: "0.05em",
                        color: "var(--ink-dim)",
                        mr: 2,
                        flexShrink: 0,
                    }}
                >
                    v{__APP_VERSION__}
                </Typography>
                {location.pathname === "/" && <Select
                    value={selectedSystemId}
                    onChange={handleSystemChange}
                    size="small"
                    variant="standard"
                    disableUnderline
                    inputProps={{ "aria-label": "Transit system" }}
                    MenuProps={{ slotProps: { paper: { sx: menuPaperSx } } }}
                    sx={{
                        color: "var(--ink)",
                        mr: { xs: 1, sm: 2 },
                        maxWidth: { xs: 140, sm: 220 },
                        fontFamily: "var(--font-display)",
                        // Same recipe as the table's status pill background,
                        // per your steer - a shrink-to-fit pill rather than a
                        // fixed-width box, so the arrow sits right after the
                        // name instead of pinned to a far-right edge. Root
                        // becomes a flex row (select-value + icon) so the
                        // icon, taken out of MUI's default absolute
                        // positioning below, lands inline right after the
                        // text and centers on the row via alignItems.
                        display: "inline-flex",
                        alignItems: "center",
                        backgroundColor: "color-mix(in srgb, var(--ink-dim) 20%, transparent)",
                        borderRadius: "20px",
                        "& .MuiSelect-icon": { color: "var(--brass)", position: "static", marginRight: "10px" },
                        "& .MuiSelect-select": {
                            textAlign: "left",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            py: "4px !important",
                            pl: "12px !important",
                            pr: "4px !important",
                        },
                    }}
                >
                    {systems.map((system) => (
                        <MenuItem key={system.id} value={system.id} sx={menuItemSx}>
                            {system.label}
                        </MenuItem>
                    ))}
                </Select>}
                <IconButton
                    size="large"
                    edge="end"
                    aria-label="page menu"
                    aria-controls={menuOpen ? "page-menu" : undefined}
                    aria-haspopup="true"
                    aria-expanded={menuOpen ? "true" : undefined}
                    onClick={handleMenuOpen}
                    sx={{ color: "var(--brass)" }}
                >
                    <MenuIcon />
                </IconButton>
                <Menu
                    id="page-menu"
                    anchorEl={anchorEl}
                    open={menuOpen}
                    onClose={handleMenuClose}
                    slotProps={{ paper: { sx: menuPaperSx } }}
                >
                    {PAGES.map((page) => (
                        <MenuItem
                            key={page.path}
                            selected={page.path === location.pathname}
                            onClick={() => { void navigate(page.path); handleMenuClose(); }}
                            sx={menuItemSx}
                        >
                            {page.label}
                        </MenuItem>
                    ))}
                </Menu>
            </Toolbar>
        </AppBar>
    );
}
