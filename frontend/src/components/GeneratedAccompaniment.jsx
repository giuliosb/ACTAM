import { useState } from "react";
import MusicSequencer from "./MusicSequencer.jsx";
import Player from "./Player.jsx";
import TrackEditor from "./TrackEditor.jsx";

export default function GeneratedAccompaniment() {
  // Total number of steps in the sequencer (a 16‑step grid)
  const STEPS = 32;

  // The main sequencer state: an array of 16 steps, and each step contains an array of events.
  // An event can be a drum hit or a chord reference.
  const [sequence, setSequence] = useState(
    Array.from({ length: STEPS }, () => [])
  );

  // List of chord definitions created by the user.
  // Each chord contains: { root, triad, extension, notes[] }
  const [chords, setChords] = useState([]);

  // Track‑level parameters for drums and chords.
  // "drums" contains three fixed tracks (kick, snare, hihat)
  // "chords" contains one track object per chord the user creates.
  const [tracks, setTracks] = useState({
    drums: {
      kick: { volume: 0, swing: 0 },
      snare: { volume: 0, swing: 0 },
      hihat: { volume: 0, swing: 0 }
    },
    chords: []
  });

  // The currently playing step (0–15). -1 means playback is stopped.
  const [currentStep, setCurrentStep] = useState(-1);

  // Which track is currently open in the TrackEditor popup.
  // Example values: { type: "drum", id: "kick" } or { type: "chord", index: 0 }
  const [openTrack, setOpenTrack] = useState(null);

  // Removes a chord from:
  //   1. the chords list
  //   2. its track settings
  //   3. all events referencing that chord in the sequence
  // Also re‑indexes remaining chord events to keep indices correct.
  const removeChord = (index) => {
    // Remove chord from chord list
    const newChords = chords.filter((_, i) => i !== index);
    setChords(newChords);

    // Remove its track settings
    setTracks(prev => ({
      ...prev,
      chords: prev.chords.filter((_, i) => i !== index)
    }));

    // Remove all events belonging to this chord
    let newSeq = sequence.map(step =>
      step.filter(ev => ev.type !== "chord" || ev.chordIndex !== index)
    );

    // Re‑index chord events: any chordIndex above the removed one shifts by -1
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

      {/* Playback controller (play, stop, bpm, master volume) */}
      <Player
        sequence={sequence}
        tracks={tracks}
        chords={chords}
        onStep={setCurrentStep}
      />

      {/* Sequencer grid + chord generator */}
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

      {/* Popup editor for drum/chord track parameters */}
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
