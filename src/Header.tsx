import { useState } from 'react';
import type { MouseEvent } from 'react';
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

// Pages this menu can navigate to. Only one exists today; add entries here as more pages land.
const PAGES = [
    { label: "Event Stream" },
];

type HeaderProps = {
    systems: TransitSystem[];
    selectedSystemId: string;
    onSystemChange: (systemId: string) => void;
};

export default function Header({ systems, selectedSystemId, onSystemChange }: HeaderProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const menuOpen = Boolean(anchorEl);

    const handleMenuOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handleSystemChange = (event: SelectChangeEvent) => onSystemChange(event.target.value);

    return (
        <AppBar position="static" color="primary" enableColorOnDark>
            <Toolbar>
                <Box
                    component="a"
                    href="/"
                    aria-label="IRL Transit home"
                    sx={{ display: "flex", alignItems: "center", flexGrow: 1, color: "inherit", textDecoration: "none" }}
                >
                    <Box sx={{ width: 40, height: 40, flexShrink: 0 }} aria-hidden="true" />
                    <Typography variant="h6" component="span" sx={{ ml: 2, textAlign: "left", fontFamily: "var(--heading)" }}>
                        <SplitFlapTitle
                            textA="IRL Transit"
                            textB="[Real-time transit info]"
                            fontFamilyB="Noto Sans, sans-serif"
                        />
                    </Typography>
                </Box>
                <Select
                    value={selectedSystemId}
                    onChange={handleSystemChange}
                    size="small"
                    variant="standard"
                    disableUnderline
                    inputProps={{ "aria-label": "Transit system" }}
                    sx={{
                        color: "inherit",
                        mr: 2,
                        minWidth: 160,
                        fontFamily: "Noto Sans, sans-serif",
                        "& .MuiSelect-icon": { color: "inherit" },
                        "& .MuiSelect-select": { textAlign: "right" },
                    }}
                >
                    {systems.map((system) => (
                        <MenuItem key={system.id} value={system.id} sx={{ justifyContent: "flex-end" }}>
                            {system.label}
                        </MenuItem>
                    ))}
                </Select>
                <IconButton
                    size="large"
                    edge="end"
                    color="inherit"
                    aria-label="page menu"
                    aria-controls={menuOpen ? "page-menu" : undefined}
                    aria-haspopup="true"
                    aria-expanded={menuOpen ? "true" : undefined}
                    onClick={handleMenuOpen}
                >
                    <MenuIcon />
                </IconButton>
                <Menu id="page-menu" anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
                    {PAGES.map((page) => (
                        <MenuItem key={page.label} onClick={handleMenuClose}>
                            {page.label}
                        </MenuItem>
                    ))}
                </Menu>
            </Toolbar>
        </AppBar>
    );
}
