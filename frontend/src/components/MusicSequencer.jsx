import { useState } from "react";
import "./MusicSequencer.css";

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const TRIADS = { Major:[0,4,7], Minor:[0,3,7], Dim:[0,3,6], Aug:[0,4,8] };
const EXTENSIONS = { "":null, "7":10, "Maj7":11, "m7":10, "6":9, "9":14, "11":17, "13":21, "Add9":14, "Sus2":2, "Sus4":5 };

export default function MusicSequencer() {
  const STEPS = 16;

  /* ----------------- STATE GENERATORE ACCORDI ----------------- */
  const [a4Frequency, setA4Frequency] = useState(440);
  const [rootNote, setRootNote] = useState("C");
  const [octave, setOctave] = useState(4);
  const [triad, setTriad] = useState("Major");
  const [extension, setExtension] = useState("");

  const [chords, setChords] = useState([]);

  const addChord = () => {
    const notes = buildChordNotes();
    setChords([...chords, {
      root: rootNote,
      triad,
      extension,
      notes
    }]);
  };

  const clearChords = () => setChords([]);


  /* ----------------- COSTRUZIONE NOTE ACCORDO ----------------- */
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

  /* ----------------- SEQUENCER (DRUM + CHORD) ----------------- */

  const DRUMS = [
    { label: "Kick", id: "kick" },
    { label: "Snare", id: "snare" },
    { label: "HiHat", id: "hihat" }
  ];

  const [sequence, setSequence] = useState(
    Array.from({ length: STEPS }, () => [])
  );

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const update = newSeq => setSequence(newSeq);


  /* ----------------- DRUM ----------------- */

  const toggleDrum = (step, drumId) => {
    const newSeq = sequence.map(s => [...s]);

    const exists = newSeq[step].some(ev => ev.type === "drum" && ev.drum === drumId);

    if (exists)
      newSeq[step] = newSeq[step].filter(ev => !(ev.type === "drum" && ev.drum === drumId));
    else
      newSeq[step].push({ id: generateId(), type: "drum", drum: drumId });

    update(newSeq);
  };

  /* ----------------- CHORD ----------------- */

  const addChordAt = (step, chordIndex) => {
    const newSeq = sequence.map(s => [...s]);

    newSeq[step].push({
      id: generateId(),
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

    const old = startObj.sustain;
    const neu = Math.max(1, old + delta);
    startObj.sustain = neu;

    const id = startObj.id;

    // rimuovi vecchi sustain
    for (let i = 0; i < STEPS; i++)
      newSeq[i] = newSeq[i].filter(ev => !(ev.type === "chord" && ev.id === id && !ev.start));

    // aggiungi nuovi sustain
    for (let i = stepIndex + 1; i < stepIndex + neu && i < STEPS; i++)
      newSeq[i].push({ id, type: "chord", chordIndex, start: false });

    update(newSeq);
  };

  const removeChordAt = (stepIndex, chordIndex) => {
    const newSeq = sequence.map(s => [...s]);

    const startObj = newSeq[stepIndex].find(
      ev => ev.type === "chord" && ev.chordIndex === chordIndex && ev.start
    );

    if (!startObj) return;

    const id = startObj.id;

    for (let i = 0; i < STEPS; i++)
      newSeq[i] = newSeq[i].filter(ev => !(ev.type === "chord" && ev.id === id));

    update(newSeq);
  };

  /* ----------------- UI ----------------- */

  return (
    <div className="music-sequencer">

      {/* ----------------- GENERATORE ACCORDI (COMPATTO) ----------------- */}
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
            {Object.keys(EXTENSIONS).map(ext => (
              <option key={ext} value={ext}>{ext || "None"}</option>
            ))}
          </select>

          <label>Oct:</label>
          <select value={octave} onChange={e => setOctave(Number(e.target.value))}>
            {[2,3,4,5,6].map(o => <option key={o}>{o}</option>)}
          </select>

          <button onClick={addChord}>Add</button>
          <button onClick={clearChords}>Clear</button>
        </div>
      </div>

      {/* ----------------- GRID ----------------- */}
      <div className="drum-grid">

        {/* Header */}
        <div className="drum-row drum-header">
          <div className="drum-cell"></div>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className="drum-cell drum-header-cell">{i + 1}</div>
          ))}
        </div>

        {/* Drum rows */}
        {DRUMS.map(drum => (
          <div key={drum.id} className="drum-row">
            <div className="drum-cell drum-name">{drum.label}</div>

            {Array.from({ length: STEPS }).map((_, step) => {
              const active = sequence[step].some(
                ev => ev.type === "drum" && ev.drum === drum.id
              );

              return (
                <div
                  key={step}
                  className={`drum-cell drum-step ${active ? "active" : ""}`}
                  onClick={() => toggleDrum(step, drum.id)}
                />
              );
            })}
          </div>
        ))}

        {/* Chord rows */}
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
                  className={`drum-cell drum-step chord-step ${isStart ? "chord-start" : ""} ${isSustain ? "chord-sustain" : ""}`}
                >
                  <div className="cell-buttons">
                    {!obj && <button onClick={() => addChordAt(step, chordIndex)}>+</button>}
                    {isStart && (
                      <>
                        <button onClick={() => changeSustain(step, chordIndex, 1)}>+</button>
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
