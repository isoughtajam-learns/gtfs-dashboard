import { Box, Typography } from "@mui/material";

// Matches the header's dropdown-menu panel treatment for section
// backgrounds, and the table's own header/row text treatment for
// titles/body respectively.
const sectionSx = {
    backgroundColor: "var(--surface-raised)",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius)",
    p: { xs: 2, sm: 3 },
    width: "80%",
    mx: "auto",
};

const titleSx = {
    fontFamily: "var(--font-mono)",
    fontSize: "1rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 600,
    color: "var(--ink-secondary)",
    mb: 1.5,
};

const bodySx = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9rem",
    color: "var(--ink)",
    lineHeight: 1.7,
};

const linkSx = {
    color: "var(--coral)",
};

export default function About() {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: { xs: 2, sm: 3 } }}>
            <Box sx={sectionSx}>
                <Typography component="h2" sx={titleSx}>About</Typography>
                <Typography component="p" sx={bodySx}>
                    IRL Transit is a live arrivals and departures board for real-world transit systems. It streams GTFS
                    Realtime trip updates over Server-Sent Events, so headsigns, stations, statuses, and
                    arrival times update the moment a vehicle reports in &mdash; no polling, no refresh
                    button. Pick a system from the header to switch feeds.
                </Typography>
                <br />
                <Typography component="p" sx={bodySx}>
                    Follow along {" "}
                    <Box component="a" href="https://github.com/users/isoughtajam-learns/projects/2/views/4" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        on Git
                    </Box> and {" "}
                    <Box component="a" href="https://github.com/isoughtajam-learns" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        reach out
                    </Box> with feature requests and questions.
                </Typography>
            </Box>
            <Box sx={sectionSx}>
                <Typography component="h2" sx={titleSx}>Data &amp; Credits</Typography>
                <Typography component="p" sx={bodySx}>
                    Powered by the{" "}
                    <Box component="a" href="https://gtfs.org/documentation/realtime/reference/" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        GTFS Realtime spec
                    </Box>
                    , with feeds sourced via the{" "}
                    <Box component="a" href="https://mobilitydatabase.org" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        Mobility Database
                    </Box>
                    . Built by {" "}
                    <Box component="a" href="https://gautamjoshi.com" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        Gautam Joshi
                    </Box> with Vite, React, MUI, and Claude.
                </Typography>
                <br/>
                <Typography component="p" sx={bodySx}>
                    <Box component="a" href="https://www.flaticon.com/free-icons/shelter" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        Shelter icons
                    </Box>  created by Magnific - Flaticon
                    <br />
                    <Box component="a" href="https://www.flaticon.com/free-icons/urban" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        Urban icons
                    </Box> created by Magnific - Flaticon
                    <br />
                    <Box component="a" href="https://www.flaticon.com/free-icons/town" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        Town icons
                    </Box> created by Magnific - Flaticon
                    <br />
                    <Box component="a" href="https://www.flaticon.com/free-icons/tree" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        Tree icons
                    </Box> created by Magnific - Flaticon
                    <br />
                    <Box component="a" href="https://www.flaticon.com/free-icons/company" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        Company icons
                    </Box> created by Magnific - Flaticon
                    <br />
                    <Box component="a" href="https://www.flaticon.com/free-icons/office" target="_blank" rel="noopener noreferrer" sx={linkSx}>
                        Office icons
                    </Box> created by Magnific - Flaticon
                </Typography>
            </Box>
        </Box>
    );
}
