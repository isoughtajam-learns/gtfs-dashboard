import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import posthog from 'posthog-js'
import './index.css'
import './styles/theme.css'
import App from './App.tsx'
import {ThemeProvider} from "@mui/material/styles";
import theme from './theme.tsx';

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
          <BrowserRouter>
              <App />
          </BrowserRouter>
      </ThemeProvider>
  </StrictMode>
)
