import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { SelectChangeEvent } from "@mui/material";
import { AppBar, Box, IconButton, Menu, MenuItem, Select, Toolbar, Typography } from "@mui/material";
import SplitFlapTitle from "./SplitFlapTitle.tsx";
import ServiceAlertsModal from "./ServiceAlertsModal.tsx";
import type { TransitSystem } from "./transitSystems.ts";

// No @mui/icons-material dependency in this project; three bars is all a hamburger needs.
function MenuIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

// Rendered by destination mode, not current mode - see the toggle button below.
function SunIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.6" />
            <path
                d="M10 1v2M10 17v2M1 10h2M17 10h2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
        </svg>
    );
}
function MoonIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M17 12.5A7.5 7.5 0 1 1 7.5 3a6 6 0 0 0 9.5 9.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
    );
}
// Outline by default, matching the Sun/Moon/hamburger icons' style; filled
// solid (plus an exclamation mark, in a contrasting color so it reads
// against the fill) when there's something to flag.
function BellIcon({ hasAlerts }: { hasAlerts: boolean }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
                d="M15 6.67A5 5 0 0 0 5 6.67c0 5.83-2.5 7.5-2.5 7.5h15s-2.5-1.67-2.5-7.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={hasAlerts ? "currentColor" : "none"}
            />
            <path d="M11.44 17.5a1.67 1.67 0 0 1-2.88 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            { hasAlerts && (
                <>
                    <line x1="10" y1="8.2" x2="10" y2="11.6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="10" cy="13.2" r="0.75" fill="#fff" />
                </>
            )}
        </svg>
    );
}

const THEME_STORAGE_KEY = "theme";

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

    // main.tsx already resolved and set this (from a saved override or
    // prefers-color-scheme) before first paint - read it back as the
    // toggle's initial state rather than re-deriving it here.
    const [themeMode, setThemeMode] = useState<"light" | "dark">(
        () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light")
    );
    const [alertsOpen, setAlertsOpen] = useState(false);
    const selectedSystemLabel = systems.find((system) => system.id === selectedSystemId)?.label;

    // Independent of the modal's own on-open fetch - this one runs whenever
    // the selected system changes, just to badge the bell, whether or not
    // the modal has ever been opened. 404/502/errors all mean "nothing to
    // show a badge for", not a real failure worth surfacing here.
    const [hasAlerts, setHasAlerts] = useState(false);
    useEffect(() => {
        if (!selectedSystemId) {
            setHasAlerts(false);
            return;
        }
        let cancelled = false;
        fetch(`/api/service_alerts/${selectedSystemId}`)
            .then(async (res) => {
                if (!res.ok) {
                    if (!cancelled) setHasAlerts(false);
                    return;
                }
                const alerts: unknown[] = await res.json();
                if (!cancelled) setHasAlerts(Array.isArray(alerts) && alerts.length > 0);
            })
            .catch(() => {
                if (!cancelled) setHasAlerts(false);
            });
        return () => { cancelled = true; };
    }, [selectedSystemId]);

    const handleMenuOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handleSystemChange = (event: SelectChangeEvent) => onSystemChange(event.target.value);

    const toggleTheme = () => {
        const next = themeMode === "dark" ? "light" : "dark";
        setThemeMode(next);
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // Toggle still works for the rest of this session.
        }
    };

    // --surface-raised with a hairline divider, no elevation shadow -
    // matches the flat treatment used everywhere else.
    const menuPaperSx = {
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--hairline)",
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
        "&:hover": { backgroundColor: "color-mix(in srgb, var(--coral) 16%, transparent)" },
        "&.Mui-selected": {
            backgroundColor: "color-mix(in srgb, var(--coral) 22%, transparent)",
            "&:hover": { backgroundColor: "color-mix(in srgb, var(--coral) 28%, transparent)" },
        },
    };

    return (
        <AppBar
            position="static"
            elevation={0}
            sx={{
                backgroundColor: "var(--surface-raised)",
                borderBottom: "1px solid var(--hairline)",
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
                            textB={"v" + __APP_VERSION__}
                            fontFamilyA="var(--font-display)"
                            fontFamilyB="var(--font-mono)"
                            colorA="var(--coral)"
                            colorB="var(--ink-secondary)"
                        />
                    </Typography>
                </Box>
                {/* Non-interactive filler - absorbs the remaining space so
                    the link above stays sized to the title text instead of
                    stretching (and being clickable) across the whole header. */}
                <Box sx={{ flexGrow: 1 }} />
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
                        backgroundColor: "color-mix(in srgb, var(--ink-secondary) 20%, transparent)",
                        borderRadius: "20px",
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
                    }}
                >
                    {systems.map((system) => (
                        <MenuItem key={system.id} value={system.id} sx={menuItemSx}>
                            {system.label}
                        </MenuItem>
                    ))}
                </Select>}
                {location.pathname === "/" && <IconButton
                    onClick={() => setAlertsOpen(true)}
                    aria-label="Service alerts"
                    sx={{ color: "var(--coral)" }}
                >
                    <BellIcon hasAlerts={hasAlerts} />
                </IconButton>}
                <IconButton
                    onClick={toggleTheme}
                    aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    sx={{ color: "var(--coral)" }}
                >
                    {/* Icon shows the destination (what clicking switches to),
                        matching the aria-label above - not the current mode. */}
                    { themeMode === "dark" ? <SunIcon /> : <MoonIcon /> }
                </IconButton>
                <IconButton
                    size="large"
                    edge="end"
                    aria-label="page menu"
                    aria-controls={menuOpen ? "page-menu" : undefined}
                    aria-haspopup="true"
                    aria-expanded={menuOpen ? "true" : undefined}
                    onClick={handleMenuOpen}
                    sx={{ color: "var(--coral)" }}
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
            <ServiceAlertsModal
                systemId={selectedSystemId}
                systemLabel={selectedSystemLabel}
                open={alertsOpen}
                onClose={() => setAlertsOpen(false)}
            />
        </AppBar>
    );
}
