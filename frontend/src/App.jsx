import { useState } from "react";
import MusicSequencer from "./components/MusicSequencer.jsx";
import Player from "./components/Player.jsx";

export default function App() {
  const STEPS = 16;

  const [sequence, setSequence] = useState(
    Array.from({ length: STEPS }, () => [])
  );

  const [chords, setChords] = useState([]);

  // Track parameters
  const [tracks, setTracks] = useState({
    drums: {
      kick: { volume: 0 },
      snare: { volume: 0 },
      hihat: { volume: 0 },
    },
    chords: []
  });

  const [currentStep, setCurrentStep] = useState(-1);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Music Sequencer</h1>

      <Player
        sequence={sequence}
        chords={chords}
        tracks={tracks}
        onStep={setCurrentStep}
      />

      <MusicSequencer
        sequence={sequence}
        onSequenceChange={setSequence}
        chords={chords}
        onChordsChange={setChords}
        tracks={tracks}
        onTracksChange={setTracks}
        currentStep={currentStep}
      />
    </div>
  );
}
