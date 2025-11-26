import { useState } from "react";
import "./MusicSequencer.css";
import {
  STEPS,
  NOTES,
  TRIADS,
  EXTENSIONS,
  DEFAULT_CHORD_TRACK,
} from "./musicConfig";
import {
  toggleDrumEvent,
  addChordEvent,
  changeChordSustain,
  removeChordEvent,
} from "./sequenceUtils";

// -----------------------------------------
//   VIEW: EDIT MODE
// -----------------------------------------
function SequencerEditView({
  sequence,
  chords,
  tracks,          // 👈 AGGIUNTO
  onChordsChange,
  onTracksChange,
  currentStep,
  toggleDrum,
  addChordAt,
  changeSustain,
  removeChordAt,
  setOpenTrack,
}) {
  const [a4Frequency, setA4Frequency] = useState(440);
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
      chords: [...(prev.chords || []), { ...DEFAULT_CHORD_TRACK }],
    }));
  };

  // Toggle live ON/OFF delle track via onTracksChange
  const toggleDrumTrackEnabled = (drumId) => {
    onTracksChange((prev) => {
      const prevDrums = prev.drums || {};
      const prevTrack = prevDrums[drumId] || {};
      const currentlyEnabled =
        prevTrack.enabled === undefined ? true : prevTrack.enabled;

      return {
        ...prev,
        drums: {
          ...prevDrums,
          [drumId]: {
            ...prevTrack,
            enabled: !currentlyEnabled,
          },
        },
      };
    });
  };

  const toggleChordTrackEnabled = (index) => {
    onTracksChange((prev) => {
      const prevChords = prev.chords || [];
      return {
        ...prev,
        chords: prevChords.map((t, i) => {
          if (i !== index) return t;
          const track = t || { ...DEFAULT_CHORD_TRACK };
          const currentlyEnabled =
            track.enabled === undefined ? true : track.enabled;

          return {
            ...DEFAULT_CHORD_TRACK,
            ...track,
            enabled: !currentlyEnabled,
          };
        }),
      };
    });
  };

  const drumTracks = tracks?.drums || {};
  const chordTracks = tracks?.chords || [];

  return (
    <div className="music-sequencer">
      <div className="generator-panel">
        <h2>Chord Generator</h2>

        <div className="gen-row">
          <label>A4 (Hz):</label>
          <input
            type="number"
            min="400"
            max="480"
            value={a4Frequency}
            onChange={(e) => setA4Frequency(Number(e.target.value))}
          />

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
          <select value={triad} onChange={(e) => setTriad(e.target.value)}>
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

        {["kick", "snare", "hihat"].map((drumId) => {
          const t = drumTracks[drumId] || {};
          const enabled = t.enabled !== false; // default ON

          return (
            <div key={drumId} className="drum-row">
              <div
                className={
                  "drum-cell drum-name" + (enabled ? "" : " muted")
                }
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  // Ctrl+click (o Cmd+click su Mac) = mute/unmute
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleDrumTrackEnabled(drumId);
                  } else {
                    // click normale = apre l’editor della track
                    setOpenTrack({ type: "drum", id: drumId });
                  }
                }}
              >
                {drumId}
                {!enabled && <span className="mute-label"> (muted)</span>}
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
          );
        })}

        {chords.map((ch, chordIndex) => {
          const t = chordTracks[chordIndex] || {};
          const enabled = t.enabled !== false;

          return (
            <div key={chordIndex} className="drum-row">
              <div
                className={
                  "drum-cell drum-name" + (enabled ? "" : " muted")
                }
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleChordTrackEnabled(chordIndex);
                  } else {
                    setOpenTrack({ type: "chord", index: chordIndex });
                  }
                }}
              >
                {ch.root} {ch.triad} {ch.extension}
                {!enabled && <span className="mute-label"> (muted)</span>}
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
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------
//   CONTAINER:
// -----------------------------------------
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
  const update = (updater) =>
    onSequenceChange((prevSequence) => updater(prevSequence));

  const toggleDrum = (step, drumId) => {
    update((prev) => toggleDrumEvent(prev, step, drumId));
  };

  const addChordAt = (step, chordIndex) => {
    update((prev) => addChordEvent(prev, step, chordIndex));
  };

  const changeSustain = (stepIndex, chordIndex, delta) => {
    update((prev) =>
      changeChordSustain(prev, stepIndex, chordIndex, delta)
    );
  };

  const removeChordAt = (step, chordIndex) => {
    update((prev) => removeChordEvent(prev, step, chordIndex));
  };

  // 👇 Sempre la vista di editing, ma con currentStep che evidenzia
  return (
    <SequencerEditView
      sequence={sequence}
      chords={chords}
      tracks={tracks}          // 👈 PASSIAMO tracks ALLA VIEW
      onChordsChange={onChordsChange}
      onTracksChange={onTracksChange}
      currentStep={currentStep}
      toggleDrum={toggleDrum}
      addChordAt={addChordAt}
      changeSustain={changeSustain}
      removeChordAt={removeChordAt}
      setOpenTrack={setOpenTrack}
    />
  );
}
