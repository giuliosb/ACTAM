import { useState } from "react";
import "./MusicSequencer.css";

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const TRIADS = { Major:[0,4,7], Minor:[0,3,7], Dim:[0,3,6], Aug:[0,4,8] };
const EXTENSIONS = {
  "": null, "7":10, "Maj7":11, "m7":10, "6":9,
  "9":14, "11":17, "13":21, "Add9":14, "Sus2":2, "Sus4":5
};

export default function MusicSequencer({
  sequence,
  onSequenceChange,
  chords,
  onChordsChange,
  currentStep,
}) {
  const STEPS = 16;

  /* ---------------------------------------------
     LOCAL STATE per il CHORD GENERATOR
  ----------------------------------------------*/
  const [a4Frequency] = useState(440);
  const [rootNote, setRootNote] = useState("C");
  const [octave, setOctave] = useState(4);
  const [triad, setTriad] = useState("Major");
  const [extension, setExtension] = useState("");

  /* ---------------------------------------------
     COSTRUZIONE ACCORDO
  ----------------------------------------------*/
  const noteFrequency = (note, octave) => {
    const n = NOTES.indexOf(note) + (octave - 4) * 12 - 9;
    return a4Frequency * Math.pow(2, n / 12);
  };

  const buildChordNotes = () => {
    const rootIndex = NOTES.indexOf(rootNote);
    const baseTriad = TRIADS[triad];

    const chordIntervals =
      extension && EXTENSIONS[extension] !== null
        ? [...baseTriad, EXTENSIONS[extension]]
        : baseTriad;

    return chordIntervals.map(interval => {
      const noteIndex = rootIndex + interval;
      const noteName = NOTES[noteIndex % 12];
      const noteOct = octave + Math.floor(noteIndex / 12);
      return {
        note: noteName,
        octave: noteOct,
        freq: noteFrequency(noteName, noteOct)
      };
    });
  };

  const addChord = () => {
    const notes = buildChordNotes();
    onChordsChange([
      ...chords,
      { root: rootNote, triad, extension, notes }
    ]);
  };

  const clearChords = () => onChordsChange([]);

  /* ---------------------------------------------
     UPDATE SEQUENCE
  ----------------------------------------------*/
  const update = (newSeq) => onSequenceChange(newSeq);

  const toggleDrum = (step, drumId) => {
    const newSeq = sequence.map(s => [...s]);
    const exists = newSeq[step].some(ev => ev.type === "drum" && ev.drum === drumId);

    if (exists)
      newSeq[step] = newSeq[step].filter(ev => !(ev.type === "drum" && ev.drum === drumId));
    else
      newSeq[step].push({ id: Math.random(), type: "drum", drum: drumId });

    update(newSeq);
  };

  const addChordAt = (step, chordIndex) => {
    const newSeq = sequence.map(s => [...s]);
    newSeq[step].push({
      id: Math.random(),
      type: "chord",
      chordIndex,
      start: true,
      sustain: 1
    });
    update(newSeq);
  };

  const changeSustain = (stepIndex, chordIndex, delta) => {
    const newSeq = sequence.map(s => s.map(ev => ({ ...ev })));
    const startObj = newSeq[stepIndex].find(
      ev => ev.type === "chord" && ev.chordIndex === chordIndex && ev.start
    );
    if (!startObj) return;

    const id = startObj.id;
    const newLen = Math.max(1, startObj.sustain + delta);
    startObj.sustain = newLen;

    for (let i = 0; i < STEPS; i++)
      newSeq[i] = newSeq[i].filter(ev => !(ev.type === "chord" && ev.id === id && !ev.start));

    for (let i = stepIndex + 1; i < stepIndex + newLen && i < STEPS; i++)
      newSeq[i].push({ id, type: "chord", chordIndex, start: false });

    update(newSeq);
  };

  const removeChordAt = (step, chordIndex) => {
    const newSeq = sequence.map(s => [...s]);
    const startObj = newSeq[step].find(
      ev => ev.type === "chord" && ev.chordIndex === chordIndex && ev.start
    );
    if (!startObj) return;

    const id = startObj.id;
    for (let i = 0; i < STEPS; i++)
      newSeq[i] = newSeq[i].filter(ev => ev.id !== id);

    update(newSeq);
  };

  /* ---------------------------------------------
     UI
  ----------------------------------------------*/

  return (
    <div className="music-sequencer">

      {/* ---------------------------------------------
          CHORD GENERATOR UI
      ----------------------------------------------*/}
      <div className="generator-panel">
        <h2>Chord Generator</h2>

        <div className="gen-row">
          <label>Root:</label>
          <select value={rootNote} onChange={e => setRootNote(e.target.value)}>
            {NOTES.map(n => <option key={n}>{n}</option>)}
          </select>

          <label>Triad:</label>
          <select value={triad} onChange={e => setTriad(e.target.value)}>
            {Object.keys(TRIADS).map(t => <option key={t}>{t}</option>)}
          </select>

          <label>Ext:</label>
          <select value={extension} onChange={e => setExtension(e.target.value)}>
            {Object.keys(EXTENSIONS).map(ext =>
              <option key={ext} value={ext}>{ext || "None"}</option>
            )}
          </select>

          <label>Oct:</label>
          <select value={octave} onChange={e => setOctave(Number(e.target.value))}>
            {[2,3,4,5,6].map(o => <option key={o}>{o}</option>)}
          </select>

          <button onClick={addChord}>Add</button>
          <button onClick={clearChords}>Clear</button>
        </div>
      </div>

      {/* ---------------------------------------------
          STEP GRID
      ----------------------------------------------*/}
      <div className="drum-grid">

        {/* HEADER */}
        <div className="drum-row drum-header">
          <div className="drum-cell"></div>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div
              key={i}
              className={`drum-cell drum-header-cell ${
                currentStep === i ? "playing" : ""
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* DRUM ROWS */}
        {["kick","snare","hihat"].map(drumId => (
          <div key={drumId} className="drum-row">
            <div className="drum-cell drum-name">{drumId}</div>

            {Array.from({ length: STEPS }).map((_, step) => {
              const active = sequence[step].some(
                ev => ev.type === "drum" && ev.drum === drumId
              );

              return (
                <div
                  key={step}
                  className={`drum-cell drum-step 
                    ${active ? "active" : ""} 
                    ${currentStep === step ? "playing" : ""}
                  `}
                  onClick={() => toggleDrum(step, drumId)}
                />
              );
            })}
          </div>
        ))}

        {/* CHORD ROWS */}
        {chords.map((ch, chordIndex) => (
          <div key={chordIndex} className="drum-row">
            <div className="drum-cell drum-name">
              {ch.root} {ch.triad} {ch.extension}
            </div>

            {Array.from({ length: STEPS }).map((_, step) => {
              const obj = sequence[step].find(
                ev => ev.type === "chord" && ev.chordIndex === chordIndex
              );

              const isStart = obj?.start;
              const isSustain = obj && !obj.start;

              return (
                <div
                  key={step}
                  className={`drum-cell drum-step chord-step
                    ${isStart ? "chord-start" : ""}
                    ${isSustain ? "chord-sustain" : ""}
                    ${currentStep === step ? "playing" : ""}
                  `}
                >
                  <div className="cell-buttons">
                    {!obj && (
                      <button onClick={() => addChordAt(step, chordIndex)}>+</button>
                    )}
                    {isStart && (
                      <>
                        <button onClick={() => changeSustain(step, chordIndex, +1)}>+</button>
                        <button onClick={() => changeSustain(step, chordIndex, -1)}>-</button>
                        <button onClick={() => removeChordAt(step, chordIndex)}>x</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      </div>
    </div>
  );
}
