import React, { useState } from "react";
import ChordGenerator from "./ChordGenerator";
import Sequencer from "./Sequencer";
import ChordPlayer from "./Player";

export default function GeneratedAccompaniment() {
  const [chords, setChords] = useState([]);
  const [sequence, setSequence] = useState([]);
  const [bpm, setBpm] = useState(120);

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      {/* Chord Generator */}
      <ChordGenerator onChordsChange={setChords} />

      {/* Sequencer */}
      <Sequencer chords={chords} onSequenceChange={setSequence} />

      {/* Player */}
      <ChordPlayer chords={chords} sequence={sequence} bpm={bpm} />

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
    </div>
  );
}
