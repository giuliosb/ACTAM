import { useState } from "react";
import MusicSequencer from "./MusicSequencer.jsx";
import Player from "./Player.jsx";
import TrackEditor from "./TrackEditor.jsx";

export default function GeneratedAccompaniment() {
  // Total number of steps in the sequencer (a 32-step grid)
  const STEPS = 16;

  const [sequence, setSequence] = useState(
    Array.from({ length: STEPS }, () => [])
  );

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
    const newChords = chords.filter((_, i) => i !== index);
    setChords(newChords);

    setTracks(prev => ({
      ...prev,
      chords: prev.chords.filter((_, i) => i !== index)
    }));

    let newSeq = sequence.map(step =>
      step.filter(ev => ev.type !== "chord" || ev.chordIndex !== index)
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

      <Player
        sequence={sequence}
        tracks={tracks}
        chords={chords}
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
        openTrack={openTrack}
        setOpenTrack={setOpenTrack}
      />

      <TrackEditor
        openTrack={openTrack}
        setOpenTrack={setOpenTrack}
        tracks={tracks}
        onTracksChange={setTracks}
        chords={chords}
        onChordsChange={setChords}
        sequence={sequence}
        onSequenceChange={setSequence}
        removeChord={removeChord}
      />
    </div>
  );
}
