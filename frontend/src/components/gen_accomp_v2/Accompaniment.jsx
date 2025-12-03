import { useState } from "react";
import Sequencer from "./Sequencer.jsx";
import Player from "./Player.jsx";
import { STEPS, createEmptySequence } from "./musicConfig.js";

export default function Accompaniment() {
  // Total number of steps in the sequencer 
  const [sequence, setSequence] = useState(createEmptySequence());

  const [chords, setChords] = useState([]);

  const [tracks, setTracks] = useState({
    drums: {
      kick: { volume: 0, swing: 0 },
      snare: { volume: 0, swing: 0 },
      hihat: { volume: 0, swing: 0 }
    },
    chords: []
  });

  const [currentStep, setCurrentStep] = useState(-1);

  const [openTrack, setOpenTrack] = useState(null);

  const removeChord = (index) => {
  // 1) aggiorna chords
  const newChords = chords.filter((_, i) => i !== index);
  setChords(newChords);

  // 2) aggiorna tracks.chords in modo difensivo
  setTracks(prev => {
    const prevChords = prev.chords || [];
    return {
      ...prev,
      chords: prevChords.filter((_, i) => i !== index),
    };
  });

  // 3) pulisci la sequence
  let newSeq = sequence.map(step =>
    // step dovrebbe essere sempre un array, ma nel dubbio fallback a []
    (step || []).filter(
      ev => ev.type !== "chord" || ev.chordIndex !== index
    )
  );

  newSeq = newSeq.map(step =>
    step.map(ev =>
      ev.type === "chord" && ev.chordIndex > index
        ? { ...ev, chordIndex: ev.chordIndex - 1 }
        : ev
    )
  );

  setSequence(newSeq);
};


  return (
    <div style={{ padding: "20px" }}>
      <h1>Music Sequencer</h1>


      <Sequencer
        sequence={sequence}
        onSequenceChange={setSequence}
        chords={chords}
        onChordsChange={setChords}
        tracks={tracks}
        onTracksChange={setTracks}
        currentStep={currentStep}
        openTrack={openTrack}
        setOpenTrack={setOpenTrack}
      />

      <Player
        sequence={sequence}
        tracks={tracks}
        chords={chords}
        onStep={setCurrentStep}
      />

    </div>
  );
}
