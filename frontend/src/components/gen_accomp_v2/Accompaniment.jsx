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
      kick: { volume: 0 },
      snare: { volume: 0 },
      hihat: { volume: 0 },
    },
    chords: [],
  });

  const [currentStep, setCurrentStep] = useState(-1);
  const [openTrack, setOpenTrack] = useState(null);

  const removeChord = (index) => {
    // 1) aggiorna chords
    const newChords = (Array.isArray(chords) ? chords : []).filter(
      (_, i) => i !== index
    );
    setChords(newChords);

    // 2) aggiorna tracks.chords in modo difensivo
    setTracks((prev) => {
      const safePrev = prev || {};
      const prevChords = safePrev.chords || [];
      return {
        ...safePrev,
        chords: prevChords.filter((_, i) => i !== index),
      };
    });

    // 3) pulisci la sequence
    const prevSeq = Array.isArray(sequence) ? sequence : [];
    let newSeq = prevSeq.map((step) =>
      // step dovrebbe essere sempre un array, ma nel dubbio fallback a []
      (Array.isArray(step) ? step : []).filter(
        (ev) => ev.type !== "chord" || ev.chordIndex !== index
      )
    );

    // riallinea gli indici degli accordi successivi
    newSeq = newSeq.map((step) =>
      step.map((ev) =>
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
        onRemoveChord={removeChord}
      />

      <Player
        sequence={sequence}
        tracks={tracks}
        chords={chords}
        onStep={setCurrentStep}
        onTracksChange={setTracks}
      />
    </div>
  );
}
