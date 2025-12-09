import { useState } from "react";
import "./Sequencer.css";
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

const DRUM_IDS = ["kick", "snare", "hihat", "openhat"];

export default function Sequencer({
  sequence,
  onSequenceChange,
  chords,
  onChordsChange,
  tracks,
  onTracksChange,
  currentStep,
  openTrack,
  setOpenTrack,
  onRemoveChord,
  isPlaying,
}) {
  const [a4Frequency, setA4Frequency] = useState(440);
  const [rootNote, setRootNote] = useState("C");
  const [octave, setOctave] = useState(4);
  const [triad, setTriad] = useState("Major");
  const [extension, setExtension] = useState("");
  const [selectedChordIndex, setSelectedChordIndex] = useState(null);

  const safeSequence = Array.isArray(sequence) ? sequence : [];
  const safeChords = Array.isArray(chords) ? chords : [];

  const update = (updater) =>
    onSequenceChange((prevSequence) => {
      if (isPlaying) return prevSequence;
      const prevSafe = Array.isArray(prevSequence) ? prevSequence : [];
      const next = updater(prevSafe);
      return Array.isArray(next) ? next : prevSafe;
    });

  const toggleDrum = (step, drumId) => {
    if (isPlaying) return;
    update((prev) => toggleDrumEvent(prev, step, drumId));
  };

  const addChordAt = (step, chordIndex) => {
    if (isPlaying) return;
    update((prev) => addChordEvent(prev, step, chordIndex));
  };

  const changeSustain = (stepIndex, chordIndex, delta) => {
    if (isPlaying) return;
    update((prev) => changeChordSustain(prev, stepIndex, chordIndex, delta));
  };

  const removeChordAt = (step, chordIndex) => {
    if (isPlaying) return;
    update((prev) => removeChordEvent(prev, step, chordIndex));
  };

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

  const isDuplicateChord = (root, triadName, extensionName) => {
    const list = Array.isArray(chords) ? chords : [];
    return list.some(
      (ch) =>
        ch &&
        ch.root === root &&
        ch.triad === triadName &&
        (ch.extension || "") === (extensionName || "")
    );
  };

  const addChord = () => {
    if (isPlaying) return;
    if (isDuplicateChord(rootNote, triad, extension)) return;

    const notes = buildChordNotes();

    const newChords = [
      ...(Array.isArray(chords) ? chords : []),
      { root: rootNote, triad, extension, notes },
    ];

    onChordsChange(newChords);

    onTracksChange((prev) => {
      const safePrev = prev || {};
      const prevChordsTracks = safePrev.chords || [];
      if (prevChordsTracks.length === 0) {
        return {
          ...safePrev,
          chords: [{ ...DEFAULT_CHORD_TRACK }],
        };
      }
      return safePrev;
    });
  };

  const toggleDrumTrackEnabled = (drumId) => {
    if (isPlaying) return;
    onTracksChange((prev) => {
      const safePrev = prev || {};
      const prevDrums = safePrev.drums || {};
      const prevTrack = prevDrums[drumId] || {};
      const currentlyEnabled =
        prevTrack.enabled === undefined ? true : prevTrack.enabled;

      return {
        ...safePrev,
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

  const toggleChordTrackEnabled = () => {
    if (isPlaying) return;
    onTracksChange((prev) => {
      const safePrev = prev || {};
      const prevChordsTracks = safePrev.chords || [];
      const track = prevChordsTracks[0] || { ...DEFAULT_CHORD_TRACK };

      const currentlyEnabled =
        track.enabled === undefined ? true : track.enabled;

      const newTrack = {
        ...DEFAULT_CHORD_TRACK,
        ...track,
        enabled: !currentlyEnabled,
      };

      return {
        ...safePrev,
        chords: [newTrack],
      };
    });
  };

  const drumTracks = tracks?.drums || {};
  const chordTracks = tracks?.chords || [];
  const chordTrack = chordTracks[0] || {};
  const chordsEnabled = chordTrack.enabled !== false;

  return (
    <div className={"music-sequencer" + (isPlaying ? " sequencer-locked" : "")}>
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

      <div className="sequencer-body">
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

          {DRUM_IDS.map((drumId) => {
            const t = drumTracks[drumId] || {};
            const enabled = t.enabled !== false;

            return (
              <div key={drumId} className="drum-row">
                <div
                  className={
                    "drum-cell drum-name" + (enabled ? "" : " muted")
                  }
                  onClick={(e) => {
                    if (isPlaying) return;
                    if (e.ctrlKey || e.metaKey) toggleDrumTrackEnabled(drumId);
                    else setOpenTrack({ type: "drum", id: drumId });
                  }}
                >
                  {drumId}
                  {!enabled && <span className="mute-label"> (muted)</span>}
                </div>

                {Array.from({ length: STEPS }).map((_, step) => {
                  const stepEvents = Array.isArray(safeSequence[step])
                    ? safeSequence[step]
                    : [];
                  const active = stepEvents.some(
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

          <div className="drum-row">
            <div
              className={
                "drum-cell drum-name" + (chordsEnabled ? "" : " muted")
              }
              onClick={(e) => {
                if (isPlaying) return;
                if (e.ctrlKey || e.metaKey) toggleChordTrackEnabled();
                else setOpenTrack({ type: "chord", index: 0 });
              }}
            >
              Chords
              {!chordsEnabled && (
                <span className="mute-label"> (muted)</span>
              )}
            </div>

            {Array.from({ length: STEPS }).map((_, step) => {
              const stepEvents = Array.isArray(safeSequence[step])
                ? safeSequence[step]
                : [];
              const obj = stepEvents.find((ev) => ev?.type === "chord");

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
                    if (isPlaying) return;
                    if (e.shiftKey && isStart) {
                      changeSustain(step, obj.chordIndex, +1);
                    } else if (!obj) {
                      if (selectedChordIndex !== null)
                        addChordAt(step, selectedChordIndex);
                    } else if (isStart) {
                      removeChordAt(step, obj.chordIndex);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="chord-library">
          <h3>Chord Library</h3>

          {safeChords.length === 0 && (
            <div className="chord-library-empty">
              Nessun accordo ancora. Usare il Chord Generator sopra per crearne
              uno.
            </div>
          )}

          {safeChords.map((ch, i) => {
            const isSelected = selectedChordIndex === i;
            return (
              <div
                key={i}
                className={
                  "chord-library-item" + (isSelected ? " selected" : "")
                }
                onClick={() => setSelectedChordIndex(i)}
              >
                <span>
                  {ch.root} {ch.triad} {ch.extension}
                </span>
                <button
                  type="button"
                  className="chord-library-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRemoveChord) onRemoveChord(i);
                    if (selectedChordIndex === i)
                      setSelectedChordIndex(null);
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}

          <div className="chord-library-hint">
            Seleziona un accordo e poi clicca su uno step vuoto della riga
            "Chords" nel sequencer per inserirlo.
          </div>
        </div>
      </div>
    </div>
  );
}
