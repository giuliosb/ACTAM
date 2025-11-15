import { useState } from "react";
import "./App.css";

// Import componenti
import ChordGenerator from "./components/ChordGenerator";
import Sequencer from "./components/Sequencer";
import ChordPlayer from "./components/Player";
import AudioProcessor from "./components/AudioProcessor"; 

function App() {
  const [chords, setChords] = useState([]);       // lista accordi
  const [sequence, setSequence] = useState([]);   // sequenza per Sequencer
  const [bpm, setBpm] = useState(120);

  // Callback per aggiornare la sequence dal Sequencer
  const handleSequenceChange = (newSeq) => {
    setSequence(newSeq);
  };

  return (
    <div className="App" style={{ padding: "20px", fontFamily: "sans-serif" }}>
      {/* Chord Generator */}
      { <ChordGenerator onChordsChange={setChords} /> }

      {/* Sequencer */}
      { <Sequencer
        chords={chords}
        onSequenceChange={handleSequenceChange}
      /> }

      {/* Player */}
      {/* <ChordPlayer
        chords={chords}
        sequence={sequence}
        bpm={bpm}
      /> */}

      {/* BPM Control */}
      <div style={{ marginTop: "20px" }}>
        <label>BPM: </label>
        <input
          type="number"
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          style={{ marginLeft: "10px", padding: "5px", width: "60px" }}
        />
      </div>


      <AudioProcessor />
      
    </div>
  );
}

export default App;
