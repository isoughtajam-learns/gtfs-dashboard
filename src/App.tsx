import { useEffect, useState } from 'react'
import './App.css'
import EventStreamComponent from "./EventStreamComponent.tsx";
import Header from "./Header.tsx";
import { fetchTransitSystems } from "./transitSystems.ts";
import type { TransitSystem } from "./transitSystems.ts";
import {Grid} from "@mui/material";


function App() {
  const [systems, setSystems] = useState<TransitSystem[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchTransitSystems()
      .then((fetched) => {
        if (cancelled) return;
        setSystems(fetched);
        setSelectedSystemId((current) => current || fetched[0]?.id || "");
      })
      .catch((error: unknown) => {
        console.error("Failed to load transit systems:", error);
      });
    return () => { cancelled = true; };
  }, []);

  return (
      <>
        <Header systems={systems} selectedSystemId={selectedSystemId} onSystemChange={setSelectedSystemId} />
        <Grid container direction="row" spacing={2}>
          <Grid size={12} sx={{backgroundColor: "gray", height: "90%"}} spacing={2}>
            <EventStreamComponent systemId={selectedSystemId} />
          </Grid>
        </Grid>
      </>
  )
}

export default App
