import './App.css'
import EventStreamComponent from "./EventStreamComponent.tsx";
import {Grid} from "@mui/material";


function App() {
  return (
      <Grid container direction="row" spacing={2}>
        <Grid size={12} sx={{backgroundColor: "gray", height: "90%"}} spacing={2}>
          <EventStreamComponent />
        </Grid>
      </Grid>
    // <EventStreamComponent />
  )
}

export default App
