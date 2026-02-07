import { useState } from "react";
import "./Sequencer.css";
import {
  DEFAULT_STEPS,
  DEFAULT_CHORD_TRACK,
} from "./musicConfig";
import {
  toggleDrumEvent,
  addChordEvent,
  changeChordSustain,
  removeChordEvent,
  clearChordSustainFromStep,
} from "./sequenceUtils";

const ROOT_CLASS_MAP = {
  C: "c",
  G: "g",
  D: "d",
  A: "a",
  E: "e",
  B: "b",
  "F#": "fsharp",
  "C#": "csharp",
  "D#": "dsharp",
  "G#": "gsharp",
  "A#": "asharp",
  Db: "db",
  Eb: "eb",
  Ab: "ab",
  Bb: "bb",
  F: "f",
};

const TRIAD_CLASS_MAP = {
  Major: "major",
  Minor: "minor",
  "Dim (-)": "dim",
  "Aug (+)" : "aug",
};
const TRIAD_LABEL_MAP = {
  "Dim (-)": "-",
  "Aug (+)": "+",
}
const EXT_LABEL_MAP = {
  "": "",
  "6": "6",
  "7": "7",
  m7: "m7",
  Maj7: "Δ7",
  "9": "9",
  "11": "11",
  "13": "13",
  Add9: "add9",
  Sus2: "sus2",
  Sus4: "sus4",
};

const DEFAULT_STEPS_PER_BLOCK = 22; // If we want something other than 4/4, this should be changed

const getChordVisuals = (chord) => {
  if (!chord) return {};
  const rootClass = ROOT_CLASS_MAP[chord.root] || "";
  const triadClass = TRIAD_CLASS_MAP[chord.triad] || "";
  const triadPrefix = TRIAD_LABEL_MAP[chord.triad] || "";
  const extSuffix =
    EXT_LABEL_MAP[chord.extension] ?? chord.extension ?? "";
  const extLabel = `${triadPrefix}${extSuffix}`;
 
  return { rootClass, triadClass, extLabel };
};

const DRUM_IDS = ["kick", "snare", "hihat", "openhat"];



export function getSequencerSnapshot({ sequence, steps = DEFAULT_STEPS }) {
  const safeSequence = Array.isArray(sequence) ? sequence : [];
  const stepCount =
    Number.isFinite(steps) && steps > 0 ? steps : DEFAULT_STEPS;

  return Array.from({ length: stepCount }, (_, stepIndex) => {
    const events = Array.isArray(safeSequence[stepIndex])
      ? safeSequence[stepIndex]
      : [];

    const drums = DRUM_IDS.reduce((acc, drumId) => {
      acc[drumId] = events.some(
        (ev) => ev.type === "drum" && ev.drum === drumId
      );
      return acc;
    }, {});

    const chords = events
      .filter((ev) => ev.type === "chord")
      .map((ev) => ({
        id: ev.id,
        chordIndex: Number.isFinite(ev.chordIndex) ? ev.chordIndex : null,
        start: Boolean(ev.start),
        sustain:
          ev.start && Number.isFinite(ev.sustain) ? ev.sustain : undefined,
      }));

    return {
      step: stepIndex,
      drums,
      chords,
    };
  });
}

export function buildSequenceFromSnapshot(snapshot, steps = DEFAULT_STEPS) {
  const safeSnapshot = Array.isArray(snapshot) ? snapshot : [];
  const stepCount =
    Number.isFinite(steps) && steps > 0 ? steps : DEFAULT_STEPS;

  return Array.from({ length: stepCount }, (_, stepIndex) => {
    const entry = safeSnapshot[stepIndex] || {};
    const drums = entry.drums || {};
    const chordRows = Array.isArray(entry.chords) ? entry.chords : [];

    const events = [];

    for (const drumId of DRUM_IDS) {
      if (drums[drumId]) {
        events.push({
          id: `drum-${stepIndex}-${drumId}-${Math.random().toString(36)}`,
          type: "drum",
          drum: drumId,
        });
      }
    }

    for (const chord of chordRows) {
      if (!chord || typeof chord !== "object") continue;
      const { id, chordIndex, start, sustain } = chord;
      const chordEvent = {
        id: id ?? Math.random(),
        type: "chord",
        chordIndex: Number.isFinite(chordIndex) ? chordIndex : null,
        start: Boolean(start),
      };
      if (chordEvent.start && Number.isFinite(sustain)) {
        chordEvent.sustain = sustain;
      }
      events.push(chordEvent);
    }

    return events;
  });
}

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
  steps = DEFAULT_STEPS,
  stepsPerBlock = DEFAULT_STEPS_PER_BLOCK,
}) {
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
    update((prev) =>
      changeChordSustain(prev, stepIndex, chordIndex, delta, steps)
    );
  };

  const removeChordAt = (step, chordIndex) => {
    if (isPlaying) return;
    update((prev) => removeChordEvent(prev, step, chordIndex, steps));
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
  const blockCount = Math.ceil(steps / stepsPerBlock);
  const blocks = Array.from({ length: blockCount }, (_, blockIndex) => {
    const start = blockIndex * stepsPerBlock;
    const end = Math.min(steps, start + stepsPerBlock);
    const blockSteps = Array.from(
      { length: Math.max(end - start, 0) },
      (_, idx) => start + idx
    );
    return { start, steps: blockSteps };
  });

  const renderDrumRow = (drumId, blockSteps, blockStart) => {
    const t = drumTracks[drumId] || {};
    const enabled = t.enabled !== false;

    return (
      <div key={`${drumId}-${blockStart}`} className="drum-row">
        <div
          className={"drum-cell drum-name" + (enabled ? "" : " muted")}
          onClick={(e) => {
            if (isPlaying) return;
            if (e.ctrlKey || e.metaKey) toggleDrumTrackEnabled(drumId);
            else setOpenTrack({ type: "drum", id: drumId });
          }}
        >
          {drumId}
          {/* {!enabled && <span className="mute-label"> (muted)</span>} */}
        </div>

        {blockSteps.map((step) => {
          const stepEvents = Array.isArray(safeSequence[step])
            ? safeSequence[step]
            : [];
          const active = stepEvents.some(
            (ev) => ev.type === "drum" && ev.drum === drumId
          );

          return (
            <div
              key={`${step}-${drumId}`}
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
  };

  const renderChordRow = (blockSteps) => (
    <div className="drum-row">
      <div
        className={"drum-cell drum-name" + (chordsEnabled ? "" : " muted")}
        onClick={(e) => {
          if (isPlaying) return;
          if (e.ctrlKey || e.metaKey) toggleChordTrackEnabled();
          else setOpenTrack({ type: "chord", index: 0 });
        }}
      >
        Chords
        {/* {!chordsEnabled && <span className="mute-label"> (muted)</span>} */}
      </div>

      {blockSteps.map((step) => {
        const stepEvents = Array.isArray(safeSequence[step])
          ? safeSequence[step]
          : [];
        const obj = stepEvents.find((ev) => ev?.type === "chord");

        const chordMeta = obj ? getChordVisuals(safeChords[obj.chordIndex]) : {};
        const rootClass = chordMeta.rootClass
          ? ` chord-root-${chordMeta.rootClass}`
          : "";
        const triadClass = chordMeta.triadClass
          ? ` triad-${chordMeta.triadClass}`
          : "";
        const isStart = obj?.start;
        const isSustain = obj && !obj.start;

        return (
          <div
            key={`chord-${step}`}
            className={
              "drum-cell drum-step chord-step" +
              (isStart ? " chord-start" : "") +
              (isSustain ? " chord-sustain" : "") +
              (currentStep === step ? " playing" : "") +
              rootClass +
              triadClass
            }
            data-ext-label={chordMeta.extLabel || ""}
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
              else {
                if (selectedChordIndex === null) return;

                update((prev) => {
                  const trimmed = clearChordSustainFromStep(
                    prev,
                    step,
                    obj.id,
                    steps
                  );
                  return addChordEvent(trimmed, step, selectedChordIndex);
                });
              }
            }}
          />
        );
      })}
    </div>
  );

  const renderBlock = (block) => (
    <div
      key={`block-${block.start}`}
      className="drum-grid-block"
      style={{
        gridTemplateColumns: `140px repeat(${block.steps.length}, 40px)`,
      }}
    >
      <div className="drum-row drum-header">
        <div className="drum-cell" />
        {block.steps.map((step) => (
          <div
            key={step}
            className={
              "drum-cell drum-header-cell" +
              (currentStep === step ? " playing" : "")
            }
          >
            {step + 1}
          </div>
        ))}
      </div>

      {DRUM_IDS.map((drumId) =>
        renderDrumRow(drumId, block.steps, block.start)
      )}

      {renderChordRow(block.steps)}
    </div>
  );

  return (
    <div className={"music-sequencer" + (isPlaying ? " sequencer-locked" : "")}>
      <div className="sequencer-body">
        
        <div className="drum-grid">{blocks.map((block) => renderBlock(block))}</div>

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
            const chordMeta = getChordVisuals(ch);
            return (
              <div
                key={i}
                className={
                  "chord-library-item" + (isSelected ? " selected" : "")
                  + (chordMeta.rootClass ? ` chord-root-${chordMeta.rootClass}` : "")
                  + (chordMeta.triadClass ? ` triad-${chordMeta.triadClass}` : "")
                }
                onClick={() => setSelectedChordIndex(i)}
              >
                <span className="chord-library-name">
                  <span>{ch.root} </span>
                  <span>{ch.triad} </span>
                  {ch.extension && <span>{ch.extension}</span>}
                </span>
                <button
                  type="button"
                  style={{ display: isPlaying ? "none" : "block", fontWeight: "bold" }}
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
