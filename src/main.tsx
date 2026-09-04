import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import posthog from 'posthog-js'
// Self-hosted (matching this project's existing no-CDN-at-runtime convention)
// rather than the design spec's Google Fonts @import.
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/fredoka/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'
import './styles/theme.css'
import App from './App.tsx'
import {ThemeProvider} from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from './theme.tsx';

// Runs before the first paint so there's no flash of the wrong palette:
// follows the OS setting unless the user has an explicit saved override
// (no in-app toggle control yet, but this is toggle-ready - flipping
// localStorage's "theme" key to 'light' | 'dark' is all a future toggle
// button would need to do).
// localStorage access can throw (Safari private browsing, sandboxed
// iframes, disabled storage) - an override is a nice-to-have, not worth
// crashing startup over.
let savedTheme: string | null = null;
try {
    savedTheme = localStorage.getItem('theme');
} catch {
    // Falls through to the OS preference below.
}
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.dataset.theme = savedTheme ?? (prefersDark ? 'dark' : 'light');

// No key in dev (.env.development) - skip init entirely rather than report
// local/test traffic to the same project as production (.env.production).
if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host: import.meta.env.VITE_POSTHOG_API_HOST,
        defaults: '2026-05-30',
    })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
              <App />
          </BrowserRouter>
      </ThemeProvider>
  </StrictMode>
)
