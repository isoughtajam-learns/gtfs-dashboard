import type { ReactNode } from "react";
import { Box } from "@mui/material";

// Shared shell for the feed's "nothing to show yet" states - loading, a
// genuinely empty system, and filters excluding every live trip. Previously
// each of these three duplicated the same flex/centered/py:8/role=status
// Box styling independently.
export function StatusMessage({ children }: { children: ReactNode }) {
    return (
        <Box
            role="status"
            aria-live="polite"
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.5,
                py: 8,
            }}
        >
            {children}
        </Box>
    );
}
