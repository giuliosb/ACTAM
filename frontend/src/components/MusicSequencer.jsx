import { useState } from "react";
import "./MusicSequencer.css";
import { Instrument } from "tone/build/esm/instrument/Instrument";

// List of note names in one octave
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// Interval structures (in semitones) for common triads
const TRIADS = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  Dim:   [0, 3, 6],
  Aug:   [0, 4, 8],
};

// Optional chord extensions, as semitone offsets from the root
const EXTENSIONS = {
  "": null,     // no extension
  "7": 10,
  "Maj7": 11,
  "m7": 10,
  "6": 9,
  "9": 14,
  "11": 17,
  "13": 21,
  "Add9": 14,
  "Sus2": 2,
  "Sus4": 5,
};

// PLAY VIEW SWITCH ADDED
export default function MusicSequencer({
  sequence,
  onSequenceChange,
  chords,
  onChordsChange,
  tracks,
  onTracksChange,
  currentStep,
  openTrack,
  setOpenTrack,
}) {
  const STEPS = 16;

  // Base tuning (Hz) for A4
  const [a4Frequency] = useState(440);

  // Chord generator UI state
  const [rootNote, setRootNote] = useState("C");
  const [octave, setOctave] = useState(4);
  const [triad, setTriad] = useState("Major");
  const [extension, setExtension] = useState("");

  // Convert note name + octave → frequency using equal temperament
  const noteFrequency = (note, octave) => {
    // Relative semitones from A4
    // A4 is NOTE index 9, octave 4
    const n = NOTES.indexOf(note) + (octave - 4) * 12 - 9;
    return a4Frequency * Math.pow(2, n / 12);
  };

  // Build the actual chord notes from the current generator settings
  const buildChordNotes = () => {
    const rootIndex = NOTES.indexOf(rootNote);
    const baseTriad = TRIADS[triad];

    // If an extension is selected and defined, add it to the triad
    const chordIntervals =
      extension && EXTENSIONS[extension] !== null
        ? [...baseTriad, EXTENSIONS[extension]]
        : baseTriad;

    return chordIntervals.map((interval) => {
      const noteIndex = rootIndex + interval;
      const noteName = NOTES[noteIndex % 12];
      const noteOct = octave + Math.floor(noteIndex / 12);
      return {
        note: noteName,
        octave: noteOct,
        freq: noteFrequency(noteName, noteOct),
      };
    });
  };

  // Add a new chord definition and its corresponding track settings
  const addChord = () => {
    const notes = buildChordNotes();

    // Append chord descriptor
    onChordsChange([
      ...chords,
      { root: rootNote, triad, extension, notes },
    ]);

    // Append a new chord track with default synth/effect parameters
    onTracksChange((prev) => ({
      ...prev,
      chords: [
        ...(prev.chords || []),
        {
          Instrument: "fm",
          volume: -8,
          cutoff: 1500,
          reverbMix: 0.3,
          chorusMix: 0.5,
          detune: 0,
        },
      ],
    }));
  };

  // Small helper so we always go through onSequenceChange
  const update = (newSeq) => onSequenceChange(newSeq);

  // ==========================================
  // Drum Editing
  // ==========================================

  // Toggle a single drum hit on/off at (step, drumId)
  const toggleDrum = (step, drumId) => {
    const newSeq = sequence.map((s) => [...s]);

    const exists = newSeq[step].some(
      (ev) => ev.type === "drum" && ev.drum === drumId
    );

    newSeq[step] = exists
      ? newSeq[step].filter(
          (ev) => !(ev.type === "drum" && ev.drum === drumId)
        )
      : [
          ...newSeq[step],
          { id: Math.random(), type: "drum", drum: drumId },
        ];

    update(newSeq);
  };

  // ==========================================
  // Chord Editing (grid events)
  // ==========================================

  // Add a chord start event at (step, chordIndex)
  const addChordAt = (step, chordIndex) => {
    const newSeq = sequence.map((s) => [...s]);

    newSeq[step].push({
      id: Math.random(),
      type: "chord",
      chordIndex,
      start: true,
      sustain: 1, // sustain length in steps (minimum 1)
    });

    update(newSeq);
  };

  // Change sustain length of a chord that starts at stepIndex
  const changeSustain = (stepIndex, chordIndex, delta) => {
    // Deep-clone at event level to avoid mutating original objects
    const newSeq = sequence.map((s) => s.map((ev) => ({ ...ev })));

    // Find the start event of this chord
    const startObj = newSeq[stepIndex].find(
      (ev) =>
        ev.type === "chord" && ev.chordIndex === chordIndex && ev.start
    );
    if (!startObj) return;

    const id = startObj.id;
    const newLen = Math.max(1, startObj.sustain + delta);
    startObj.sustain = newLen;

    // Remove all old sustain ghost events for this chord ID
    for (let i = 0; i < STEPS; i++) {
      newSeq[i] = newSeq[i].filter(
        (ev) => !(ev.type === "chord" && ev.id === id && !ev.start)
      );
    }

    // Create new sustain ghost events for the updated length
    for (
      let i = stepIndex + 1;
      i < stepIndex + newLen && i < STEPS;
      i++
    ) {
      newSeq[i].push({
        id,
        type: "chord",
        chordIndex,
        start: false, // sustain/continuation
      });
    }

    update(newSeq);
  };

  // Remove a chord (start + all its sustain events) starting at this step
  const removeChordAt = (step, chordIndex) => {
    const newSeq = sequence.map((s) => [...s]);

    const startObj = newSeq[step].find(
      (ev) =>
        ev.type === "chord" && ev.chordIndex === chordIndex && ev.start
    );
    if (!startObj) return;

    const id = startObj.id;

    // Remove all events with this chord ID from the whole sequence
    for (let i = 0; i < STEPS; i++) {
      newSeq[i] = newSeq[i].filter((ev) => ev.id !== id);
    }

    update(newSeq);
  };

  // ==========================================
  // PLAY MODE VIEW
  // (shown only when the transport is running)
  // ==========================================
  if (currentStep !== -1) {
    return (
      <div className="music-sequencer">
        <div className="drum-grid">
          {/* Header row with step indices */}
          <div className="drum-row drum-header">
            <div className="drum-cell" />
            {Array.from({ length: STEPS }).map((_, i) => (
              <div
                key={i}
                className={
                  "drum-cell drum-header-cell" +
                  (currentStep === i ? " playing" : "")
                }
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Drum rows (read-only in play view) */}
          {["kick", "snare", "hihat"].map((drumId) => (
            <div key={drumId} className="drum-row">
              <div className="drum-cell drum-name">{drumId}</div>

              {Array.from({ length: STEPS }).map((_, step) => {
                const active = sequence[step].some(
                  (ev) => ev.type === "drum" && ev.drum === drumId
                );

                return (
                  <div
                    key={step}
                    className={
                      "drum-cell drum-step" +
                      (active ? " active" : "") +
                      (currentStep === step ? " playing" : "")
                    }
                  />
                );
              })}
            </div>
          ))}

          {/* Chord rows (read-only in play view) */}
          {chords.map((ch, chordIndex) => (
            <div key={chordIndex} className="drum-row">
              <div className="drum-cell drum-name">
                {ch.root} {ch.triad} {ch.extension}
              </div>

              {Array.from({ length: STEPS }).map((_, step) => {
                const obj = sequence[step].find(
                  (ev) =>
                    ev.type === "chord" &&
                    ev.chordIndex === chordIndex
                );

                const isStart = obj?.start;
                const isSustain = obj && !obj.start;

                return (
                  <div
                    key={step}
                    className={
                      "drum-cell drum-step chord-step" +
                      (isStart ? " chord-start" : "") +
                      (isSustain ? " chord-sustain" : "") +
                      (currentStep === step ? " playing" : "")
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ==========================================
  // EDIT MODE VIEW (default, when not playing)
  // ==========================================
  return (
    <div className="music-sequencer">
      {/* ==========================
          CHORD GENERATOR PANEL
      =========================== */}
      <div className="generator-panel">
        <h2>Chord Generator</h2>

        <div className="gen-row">
          <label>Root:</label>
          <select
            value={rootNote}
            onChange={(e) => setRootNote(e.target.value)}
          >
            {NOTES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>

          <label>Triad:</label>
          <select
            value={triad}
            onChange={(e) => setTriad(e.target.value)}
          >
            {Object.keys(TRIADS).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <label>Ext:</label>
          <select
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
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
          >
            {[2, 3, 4, 5, 6].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>

          <button onClick={addChord}>Add</button>
        </div>
      </div>

      {/* ==========================
          SEQUENCER GRID
      =========================== */}
      <div className="drum-grid">
        {/* Header with step numbers */}
        <div className="drum-row drum-header">
          <div className="drum-cell" />
          {Array.from({ length: STEPS }).map((_, i) => (
            <div
              key={i}
              className={
                "drum-cell drum-header-cell" +
                (currentStep === i ? " playing" : "")
              }
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Drum rows (editable) */}
        {["kick", "snare", "hihat"].map((drumId) => (
          <div key={drumId} className="drum-row">
            {/* Drum name cell — opens TrackEditor for that drum */}
            <div
              className="drum-cell drum-name"
              style={{ cursor: "pointer" }}
              onClick={() =>
                setOpenTrack({ type: "drum", id: drumId })
              }
            >
              {drumId}
            </div>

            {/* Drum steps */}
            {Array.from({ length: STEPS }).map((_, step) => {
              const active = sequence[step].some(
                (ev) => ev.type === "drum" && ev.drum === drumId
              );

              return (
                <div
                  key={step}
                  className={
                    "drum-cell drum-step" +
                    (active ? " active" : "") +
                    (currentStep === step ? " playing" : "")
                  }
                  onClick={() => toggleDrum(step, drumId)}
                />
              );
            })}
          </div>
        ))}

        {/* Chord rows (editable) */}
        {chords.map((ch, chordIndex) => (
          <div key={chordIndex} className="drum-row">
            {/* Click on the chord name to open TrackEditor for that chord */}
            <div
              className="drum-cell drum-name"
              style={{ cursor: "pointer" }}
              onClick={() =>
                setOpenTrack({ type: "chord", index: chordIndex })
              }
            >
              {ch.root} {ch.triad} {ch.extension}
            </div>

            {/* Chord events across the timeline */}
            {Array.from({ length: STEPS }).map((_, step) => {
              const obj = sequence[step].find(
                (ev) =>
                  ev.type === "chord" &&
                  ev.chordIndex === chordIndex
              );

              const isStart = obj?.start;
              const isSustain = obj && !obj.start;

              return (
                <div
                  key={step}
                  className={
                    "drum-cell drum-step chord-step" +
                    (isStart ? " chord-start" : "") +
                    (isSustain ? " chord-sustain" : "") +
                    (currentStep === step ? " playing" : "")
                  }
                  // Click behavior:
                  //  - click empty cell → add chord start
                  //  - click on start cell → remove the whole chord
                  //  - Shift + click on start cell → increase sustain length
                  onClick={(e) => {
                    if (e.shiftKey) {
                      if (isStart) changeSustain(step, chordIndex, +1);
                    } else {
                      if (!obj) {
                        addChordAt(step, chordIndex);
                      } else if (isStart) {
                        removeChordAt(step, chordIndex);
                      }
                    }
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
