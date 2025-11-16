import { useState } from "react";
import MusicSequencer from "./components/MusicSequencer.jsx";
import Player from "./components/Player.jsx";

export default function App() {
  // Sequenza di 16 step × eventi
  const [sequence, setSequence] = useState(
    Array.from({ length: 16 }, () => [])
  );

  // Lista accordi generati dal Chord Generator
  const [chords, setChords] = useState([]);

  // Step corrente suonato dal Player (per highlight)
  const [currentStep, setCurrentStep] = useState(-1);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Music Sequencer</h1>

      {/* PLAYER / TRANSPORT */}
      <Player
        sequence={sequence}
        chords={chords}
        onStep={setCurrentStep}
      />

      {/* SEQUENCER GRID + CHORD GENERATOR */}
      <MusicSequencer
        sequence={sequence}
        onSequenceChange={setSequence}
        chords={chords}
        onChordsChange={setChords}
        currentStep={currentStep}
      />
    </div>
  );
}
