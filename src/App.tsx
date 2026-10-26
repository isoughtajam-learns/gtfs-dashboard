import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'
import EventStreamComponent from "./EventStreamComponent.tsx";
import Header from "./Header.tsx";
import About from "./About.tsx";
import NotFound from "./NotFound.tsx";
import { fetchTransitSystems } from "./transitSystems.ts";
import type { TransitSystem } from "./transitSystems.ts";
import {Grid} from "@mui/material";


const SELECTED_SYSTEM_STORAGE_KEY = "irl-transit:selectedSystemId";

// localStorage access can throw (Safari private browsing, sandboxed iframes,
// disabled storage) - persistence is a nice-to-have, not worth crashing over.
function readStoredSystemId(): string {
  try {
    return localStorage.getItem(SELECTED_SYSTEM_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredSystemId(systemId: string): void {
  try {
    localStorage.setItem(SELECTED_SYSTEM_STORAGE_KEY, systemId);
  } catch {
    // Selection still works for the rest of this session.
  }
}

function App() {
  const [systems, setSystems] = useState<TransitSystem[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState(readStoredSystemId);

  useEffect(() => {
    let cancelled = false;
    void fetchTransitSystems()
      .then((fetched) => {
        if (cancelled) return;
        setSystems(fetched);
        // The stored id might reference a system that's disappeared since
        // last visit - fall back to a default rather than staying on an id
        // nothing in the current list matches. BART is the preferred
        // default (first-ever visit, or a stored system that's gone); if
        // it's ever missing from the feed, fall back to whatever's first.
        setSelectedSystemId((current) => {
          if (current && fetched.some((s) => s.id === current)) return current;
          const fallback = fetched.find((s) => s.id === "BART") ?? fetched[0];
          return fallback?.id || "";
        });
      })
      .catch((error: unknown) => {
        console.error("Failed to load transit systems:", error);
      });
    return () => { cancelled = true; };
  }, []);

  // Every other caller (TransitSystemSelect's dropdown) only ever passes an
  // id drawn from `systems` itself, so it was always guaranteed valid - an
  // inter-system transfer badge (see TransferIndicators.tsx) is the first
  // caller passing an id straight from live trip/stop data instead. Guard
  // here rather than trust it, so a stale/decommissioned system id in that
  // data can't land the app on an id nothing in `systems` matches (the
  // dropdown would show blank, and the feed would fail to connect).
  const handleSystemChange = (systemId: string) => {
    if (!systems.some((s) => s.id === systemId)) return;
    setSelectedSystemId(systemId);
    writeStoredSystemId(systemId);
  };

  return (
      <>
        <Header
          systems={systems}
          selectedSystemId={selectedSystemId}
          onSystemChange={handleSystemChange}
        />
        <Grid container direction="row" spacing={2}>
          <Grid size={12} sx={{backgroundColor: "var(--bg)", height: "90%"}} spacing={2}>
            <Routes>
              <Route
                path="/"
                element={
                  <EventStreamComponent
                    systemId={selectedSystemId}
                    systems={systems}
                    onSystemChange={handleSystemChange}
                  />
                }
              />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Grid>
        </Grid>
      </>
  )
}

export default App
