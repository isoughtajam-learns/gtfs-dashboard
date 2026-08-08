import {createTheme} from "@mui/material/styles";

const theme = createTheme({
    palette: {
        primary: {
            main: '#443D4C',  // R:68 G:61 B:76 eggplant
            light: '#A67B87', // R:166 G:123 B:135 light pink
        },
        secondary: {
            main: '#D8827A',  // R:216 G:130 B:122 salmon
        },
        background: {
            default: '#B3AD9F', // R:179 G:173 B:159 tan
            paper: '#777572',   // R:119 G:117 B:114 gray
        },
    },
});

export default theme;