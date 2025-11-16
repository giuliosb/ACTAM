import { useState } from "react";
import MusicSequencer from "./components/MusicSequencer.jsx";

export default function App() {
  const [chords, setChords] = useState([]);
  const [sequence, setSequence] = useState([]);

  return (
    <div style={{ padding: "20px" }}>
      {/*<h1>Music Lab</h1>

      <ChordGenerator onChordsChange={setChords} />

      <div style={{ height: "20px" }} />

      <DrumMachine
        chords={chords}
        onSequenceChange={setSequence}
      />

      <h3>Debug chords:</h3>
      <pre>{JSON.stringify(chords, null, 2)}</pre>

      <h3>Debug sequence:</h3>
      <pre>{JSON.stringify(sequence, null, 2)}</pre>*/}
      <MusicSequencer/>
    </div>
  );
}
