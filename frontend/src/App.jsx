import { useState } from "react";
import MusicSequencer from "./components/MusicSequencer.jsx";
import Player from "./components/Player.jsx";

export default function App() {
  const STEPS = 16;

  // Sequenza di 16 step × eventi
  const [sequence, setSequence] = useState(
    Array.from({ length: STEPS }, () => [])
  );

  // Lista accordi generati dal Chord Generator
  const [chords, setChords] = useState([]);

  // Parametri per-riga (drums + una track per ogni accordo)
  const [tracks, setTracks] = useState({
    drums: {
      kick: { volume: 0 },
      snare: { volume: 0 },
      hihat: { volume: 0 },
    },
    chords: [], // un oggetto per ogni riga-accordo
  });

  // Step corrente suonato dal Player (per highlight)
  const [currentStep, setCurrentStep] = useState(-1);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Music Sequencer</h1>

      {/* PLAYER / TRANSPORT */}
      <Player
        sequence={sequence}
        chords={chords}
        tracks={tracks}
        onStep={setCurrentStep}
      />

      {/* SEQUENCER GRID + CHORD GENERATOR */}
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
