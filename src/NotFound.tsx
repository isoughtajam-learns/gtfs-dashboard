import { Box, Typography } from "@mui/material";
import { Link } from "react-router-dom";

// Mirrors About.tsx's section treatment (same background/border/radius),
// but centered and taller since there's only one short message to show,
// not a page of body text.
const sectionSx = {
    backgroundColor: "var(--surface-raised)",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 1.5,
    p: { xs: 4, sm: 6 },
    width: "80%",
    mx: "auto",
    mt: { xs: 4, sm: 8 },
    textAlign: "center" as const,
};

const codeSx = {
    fontFamily: "var(--font-mono)",
    fontSize: "2.5rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "var(--coral)",
};

const bodySx = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9rem",
    color: "var(--ink-secondary)",
};

const linkSx = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    color: "var(--coral)",
};

// Catch-all route (see App.tsx's path="*") - the only 404 case that's an
// actual page navigation. TripDetailCard's own 404 (a trip not currently in
// the live feed) is a separate, narrower in-modal message - see its own
// error handling, not this component.
export default function NotFound() {
    return (
        <Box sx={sectionSx}>
            <Typography component="p" sx={codeSx}>404</Typography>
            <Typography component="p" sx={bodySx}>
                This page doesn&apos;t exist.
            </Typography>
            <Box component={Link} to="/" sx={{ ...linkSx, textDecoration: "none" }}>
                Back to the live feed
            </Box>
        </Box>
    );
}
