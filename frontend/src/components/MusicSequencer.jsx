import { useState } from "react";
import "./MusicSequencer.css";

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const TRIADS = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  Dim:   [0, 3, 6],
  Aug:   [0, 4, 8],
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
  "Sus4": 5,
};

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

  const [a4Frequency] = useState(440);

  const [rootNote, setRootNote] = useState("C");
  const [octave, setOctave] = useState(4);
  const [triad, setTriad] = useState("Major");
  const [extension, setExtension] = useState("");

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

  const addChord = () => {
    const notes = buildChordNotes();

    onChordsChange([
      ...chords,
      { root: rootNote, triad, extension, notes },
    ]);

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

  const update = (newSeq) => onSequenceChange(newSeq);

  // ------------------------------------------------------
  // 1. TOGGLE DRUM (MODIFICATO - NO DEEP CLONE)
  // ------------------------------------------------------
  const toggleDrum = (step, drumId) => {
    const newSeq = [...sequence];
    const events = [...newSeq[step]];

    const exists = events.some(
      (ev) => ev.type === "drum" && ev.drum === drumId
    );

    newSeq[step] = exists
      ? events.filter((ev) => !(ev.type === "drum" && ev.drum === drumId))
      : [...events, { id: Math.random(), type: "drum", drum: drumId }];

    update(newSeq);
  };

  // ------------------------------------------------------
  // 2. ADD CHORD AT STEP (MODIFICATO)
  // ------------------------------------------------------
  const addChordAt = (step, chordIndex) => {
    const newSeq = [...sequence];
    newSeq[step] = [
      ...newSeq[step],
      {
        id: Math.random(),
        type: "chord",
        chordIndex,
        start: true,
        sustain: 1,
      },
    ];

    update(newSeq);
  };

  // ------------------------------------------------------
  // 3. CHANGE SUSTAIN (MODIFICATO - NO DEEP CLONE)
  // ------------------------------------------------------
  const changeSustain = (stepIndex, chordIndex, delta) => {
    const newSeq = [...sequence];

    // Clone solo lo step di partenza
    const startEvents = [...newSeq[stepIndex]];
    newSeq[stepIndex] = startEvents;

    const startObj = startEvents.find(
      (ev) =>
        ev.type === "chord" &&
        ev.chordIndex === chordIndex &&
        ev.start
    );
    if (!startObj) return;

    const id = startObj.id;
    const newLen = Math.max(1, startObj.sustain + delta);
    startObj.sustain = newLen;

    // Rimuovi i vecchi sustain solo dove servono
    for (let i = stepIndex + 1; i < STEPS; i++) {
      const has = newSeq[i].some((ev) => ev.id === id);
      if (!has) break; // se gli step successivi non hanno più sustain, fermati
      newSeq[i] = newSeq[i].filter((ev) => ev.id !== id);
    }

    // Aggiungi i nuovi sustain
    for (
      let i = stepIndex + 1;
      i < stepIndex + newLen && i < STEPS;
      i++
    ) {
      newSeq[i] = [
        ...newSeq[i],
        {
          id,
          type: "chord",
          chordIndex,
          start: false,
        },
      ];
    }

    update(newSeq);
  };

  // ------------------------------------------------------
  // 4. REMOVE CHORD (MODIFICATO - SOLO STEPS NECESSARI)
  // ------------------------------------------------------
  const removeChordAt = (step, chordIndex) => {
    const newSeq = [...sequence];

    const startObj = newSeq[step].find(
      (ev) =>
        ev.type === "chord" &&
        ev.chordIndex === chordIndex &&
        ev.start
    );
    if (!startObj) return;

    const id = startObj.id;

    // Rimuovi l’evento di start
    newSeq[step] = newSeq[step].filter((ev) => ev.id !== id);

    // Rimuovi i sustain SOLO dove e se esistono
    for (let i = step + 1; i < STEPS; i++) {
      const had = newSeq[i].some((ev) => ev.id === id);
      if (!had) break; // stop appena finisce la "scia"
      newSeq[i] = newSeq[i].filter((ev) => ev.id !== id);
    }

    update(newSeq);
  };

  // -------------------------------
  //   PLAY MODE VIEW (INVARIATO)
  // -------------------------------
  if (currentStep !== -1) {
    return (
      <div className="music-sequencer">
        <div className="drum-grid">
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

  // -------------------------------
  //   EDIT MODE VIEW (INVARIATO)
  // -------------------------------
  return (
    <div className="music-sequencer">
      <div className="generator-panel">
        <h2>Chord Generator</h2>

        <div className="gen-row">
          <label>Root:</label>
          <select value={rootNote} onChange={(e) => setRootNote(e.target.value)}>
            {NOTES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>

          <label>Triad:</label>
          <select value={triad} onChange={(e) => setTriad(e.target.value)}>
            {Object.keys(TRIADS).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <label>Ext:</label>
          <select value={extension} onChange={(e) => setExtension(e.target.value)}>
            {Object.keys(EXTENSIONS).map((ext) => (
              <option key={ext} value={ext}>
                {ext || "None"}
              </option>
            ))}
          </select>

          <label>Oct:</label>
          <select value={octave} onChange={(e) => setOctave(Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>

          <button onClick={addChord}>Add</button>
        </div>
      </div>

      <div className="drum-grid">
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

        {["kick", "snare", "hihat"].map((drumId) => (
          <div key={drumId} className="drum-row">
            <div
              className="drum-cell drum-name"
              style={{ cursor: "pointer" }}
              onClick={() => setOpenTrack({ type: "drum", id: drumId })}
            >
              {drumId}
            </div>

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

        {chords.map((ch, chordIndex) => (
          <div key={chordIndex} className="drum-row">
            <div
              className="drum-cell drum-name"
              style={{ cursor: "pointer" }}
              onClick={() =>
                setOpenTrack({ type: "chord", index: chordIndex })
              }
            >
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
