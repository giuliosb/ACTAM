import { useState } from "react";
import "./Sequencer.css";
import {
  DEFAULT_STEPS,
  DEFAULT_CHORD_TRACK,
  DRUM_IDS,
  DEFAULT_STEPS_PER_BLOCK,
} from "./utils/musicConfig";
import {
  toggleDrumEvent,
  addChordEvent,
  changeChordSustain,
  removeChordEvent,
  clearChordSustainFromStep,
  getSequencerSnapshot,
  buildSequenceFromSnapshot,
} from "./utils/sequenceUtils";
import { getChordVisuals } from "./utils/chordVisuals";

/**
 * Main sequencer UI component.
 *
 * Responsibilities:
 * - Renders the drum grid and chord grid.
 * - Allows users to add/remove drum events.
 * - Allows users to add/remove chord events.
 * - Allows chord sustain editing.
 * - Allows track opening and muting.
 * - Renders the chord library and manages selected chord state.
 *
 * Data model:
 * - `sequence` contains step-based musical events.
 * - `tracks` contains track-level settings such as enabled/muted state.
 * - `chords` contains the chord library used by chord events.
 */
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
  /**
  * Index of the currently selected chord in the chord library.
  *
  * null means no chord is selected.
  * When a chord is selected, clicking an empty chord step inserts that chord.
  */
  const [selectedChordIndex, setSelectedChordIndex] = useState(null);

  /**
  * Defensive sequence value used by the renderer.
  *
  * The UI expects `sequence` to be an array. If invalid data is received,
  * this fallback prevents `.map`, indexing, and event lookup operations from
  * throwing errors.
  */
  const safeSequence = Array.isArray(sequence) ? sequence : [];
  
  /**
  * Defensive chord-library value used by the renderer.
  *
  * The chord grid stores only `chordIndex` values, so this array is used to
  * look up the visible chord name and CSS visual metadata.
  */
  const safeChords = Array.isArray(chords) ? chords : [];

  const updateSequence = (updater) =>
    onSequenceChange((prevSequence) => {
      if (isPlaying) return prevSequence;
      const prevSafe = Array.isArray(prevSequence) ? prevSequence : [];
      const next = updater(prevSafe);
      return Array.isArray(next) ? next : prevSafe;
    });

  const toggleDrum = (step, drumId) => {
    if (isPlaying) return;
    updateSequence((prev) => toggleDrumEvent(prev, step, drumId));
  };

  const addChordAt = (step, chordIndex) => {
    if (isPlaying) return;
    updateSequence((prev) => addChordEvent(prev, step, chordIndex));
  };

  const changeSustain = (stepIndex, chordIndex, delta) => {
    if (isPlaying) return;
    updateSequence((prev) =>
      changeChordSustain(prev, stepIndex, chordIndex, delta, steps)
    );
  };

  const removeChordAt = (step, chordIndex) => {
    if (isPlaying) return;
    updateSequence((prev) => removeChordEvent(prev, step, chordIndex, steps));
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
        chords
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

                updateSequence((prev) => {
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
          <h3 style={{ marginBottom: "6px" }}>chord library</h3>

          {safeChords.length === 0 && (
            <div className="chord-library-empty">
              Add chords to the library
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
        </div>
      </div>
    </div>
  );
}
