import React from "react";
import './Sequencer.css' 
import {
  NOTES,
  TRIADS,
  EXTENSIONS,
} from "./musicConfig";

export default function ChordGenerator({
  a4Frequency,
  setA4Frequency,
  rootNote,
  setRootNote,
  triad,
  setTriad,
  extension,
  setExtension,
  octave,
  setOctave,
  addChord,
  isDuplicateChord,
  isPlaying,
}) {
  return (
    <div className="generator-panel">
      <h2>chord generator</h2>

      <div className="gen-row pixelFont">
        <label>A4 (Hz):</label>
        <input
          type="number"
          min="400"
          max="480"
          value={a4Frequency}
          onChange={(e) => setA4Frequency(Number(e.target.value))}
          disabled={isPlaying}
        />

        <label>Root:</label>
        <select
          value={rootNote}
          onChange={(e) => setRootNote(e.target.value)}
          disabled={isPlaying}
        >
          {NOTES.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>

        <label>Triad:</label>
        <select
          value={triad}
          onChange={(e) => setTriad(e.target.value)}
          disabled={isPlaying}
        >
          {Object.keys(TRIADS).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <label>Ext:</label>
        <select
          value={extension}
          onChange={(e) => setExtension(e.target.value)}
          disabled={isPlaying}
        >
          {Object.keys(EXTENSIONS).map((ext) => (
            <option key={ext} value={ext}>
              {ext || "None"}
            </option>
          ))}
        </select>

        <label>Oct:</label>
        <select
          value={octave}
          onChange={(e) => setOctave(Number(e.target.value))}
          disabled={isPlaying}
        >
          {[2, 3, 4, 5, 6].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>

        <button
          onClick={addChord}
          disabled={isPlaying || isDuplicateChord(rootNote, triad, extension)}
        >
          {isDuplicateChord(rootNote, triad, extension)
            ? "Already added"
            : "Add"}
        </button>
      </div>
    </div>
  );
}
