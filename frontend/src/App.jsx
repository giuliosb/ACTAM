import { useState } from "react";
import "./App.css";

// Import componenti
import ChordGenerator from "./components/ChordGenerator";
import Sequencer from "./components/Sequencer";
import ChordPlayer from "./components/Player";

function App() {
  const [chords, setChords] = useState([]);
  const [sequence, setSequence] = useState([]);
  const [bpm, setBpm] = useState(120);

  return (
    <div className="App">

      {/* Chord Generator */}
      <ChordGenerator onChordsChange={setChords} />

      {/* Sequencer */}
      <Sequencer
        chords={chords}
        onSequenceChange={setSequence}
      />

      {/* Player */}
      <ChordPlayer
        chords={chords}
        sequence={sequence}
        bpm={bpm}
      />

      {/* BPM Control */}
      <div style={{ marginTop: "20px" }}>
        <label>BPM: </label>
        <input
          type="number"
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          style={{ marginLeft: "10px", padding: "5px" }}
        />
      </div>

    </div>
  );
}

export default App;
