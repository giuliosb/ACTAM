import { useState } from "react";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const TRIADS = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  Dim: [0, 3, 6],
  Aug: [0, 4, 8]
};

const EXTENSIONS = {
  "": null,
  "7": 10,
  "Maj7": 11,
  "m7": 10,
  "6": 9,
  "9": 14,
  "11": 17,
  "13": 21,
  "Add9": 14,
  "Sus2": 2,
  "Sus4": 5
};

export default function ChordBuilder() {
  const [a4Frequency, setA4Frequency] = useState(440);
  const [rootNote, setRootNote] = useState("C");
  const [octave, setOctave] = useState(4);
  const [triad, setTriad] = useState("Major");
  const [extension, setExtension] = useState("");
  const [chords, setChords] = useState([]);

  const noteFrequency = (note, octave) => {
    const n = NOTES.indexOf(note) + (octave - 4) * 12 - 9;
    return a4Frequency * Math.pow(2, n / 12);
  };

  const buildChordNotes = () => {
    const rootIndex = NOTES.indexOf(rootNote);
    const baseTriad = TRIADS[triad];
    const chordIntervals = extension && EXTENSIONS[extension] !== null ? [...baseTriad, EXTENSIONS[extension]] : baseTriad;

    return chordIntervals.map(interval => {
      const noteIndex = rootIndex + interval;
      const noteName = NOTES[noteIndex % 12];
      const noteOctave = octave + Math.floor(noteIndex / 12);
      return { note: noteName, octave: noteOctave, freq: noteFrequency(noteName, noteOctave) };
    });
  };

  const addChord = () => {
    const chordNotes = buildChordNotes();
    setChords(prev => [...prev, { root: rootNote, triad, extension, notes: chordNotes }]);
  };

  const clearChords = () => setChords([]);

  const endChords = () => {
    console.log("Final chords:", chords);
    alert(`Accordi salvati: ${chords.length}`);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Chord Builder</h2>

      <div>
        <label>A4 Frequency (Hz): </label>
        <input type="number" value={a4Frequency} onChange={e => setA4Frequency(Number(e.target.value) || 0)} className="ml-2 border p-1" />
      </div>

      <div>
        <label>Root Note: </label>
        <select value={rootNote} onChange={e => setRootNote(e.target.value)} className="border p-1 ml-2">
          {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div>
        <label>Triad: </label>
        <select value={triad} onChange={e => setTriad(e.target.value)} className="border p-1 ml-2">
          {Object.keys(TRIADS).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label>Extension (optional): </label>
        <select value={extension} onChange={e => setExtension(e.target.value)} className="border p-1 ml-2">
          {Object.keys(EXTENSIONS).map(ext => <option key={ext} value={ext}>{ext || "None"}</option>)}
        </select>
      </div>

      <div>
        <label>Octave: </label>
        <select value={octave} onChange={e => setOctave(Number(e.target.value))} className="border p-1 ml-2">
          {[2,3,4,5,6].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mt-2">
        <button onClick={addChord} className="border px-4 py-2">Add Chord</button>
        <button onClick={clearChords} className="border px-4 py-2">Clear Chords</button>
        <button onClick={endChords} className="border px-4 py-2">End</button>
      </div>

      <div className="mt-4">
        <h3 className="font-semibold">Chords:</h3>
        <pre>{JSON.stringify(chords, null, 2)}</pre>
      </div>
    </div>
  );
}
