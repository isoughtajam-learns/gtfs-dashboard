import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'
import EventStreamComponent from "./EventStreamComponent.tsx";
import Header from "./Header.tsx";
import About from "./About.tsx";
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
        // last visit - fall back to the first one rather than staying on
        // an id nothing in the current list matches.
        setSelectedSystemId((current) =>
          current && fetched.some((s) => s.id === current) ? current : fetched[0]?.id || ""
        );
      })
      .catch((error: unknown) => {
        console.error("Failed to load transit systems:", error);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSystemChange = (systemId: string) => {
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
              <Route path="/" element={<EventStreamComponent systemId={selectedSystemId} />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </Grid>
        </Grid>
      </>
  )
}

export default App
