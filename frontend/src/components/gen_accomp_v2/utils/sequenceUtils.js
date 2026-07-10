// sequenceUtils.js
import { DEFAULT_STEPS, DRUM_IDS } from "./musicConfig";

const ensureSteps = (steps) =>
  Number.isFinite(steps) && steps > 0 ? steps : DEFAULT_STEPS;

// Funzione di utilità per copiare la sequenza (copia shallow di ogni step)
const cloneSequence = (sequence) =>
  sequence.map((events) => (events ? [...events] : []));

// ------------------------------------------------------
// TOGGLE DRUM
// ------------------------------------------------------
export function toggleDrumEvent(sequence, step, drumId) {
  const newSeq = cloneSequence(sequence);
  const events = newSeq[step] || [];

  const exists = events.some(
    (ev) => ev.type === "drum" && ev.drum === drumId
  );

  newSeq[step] = exists
    ? events.filter((ev) => !(ev.type === "drum" && ev.drum === drumId))
    : [...events, { id: Math.random(), type: "drum", drum: drumId }];

  return newSeq;
}

// ------------------------------------------------------
// ADD CHORD (start) A UNO STEP
// ------------------------------------------------------
export function addChordEvent(sequence, step, chordIndex) {
  const newSeq = cloneSequence(sequence);
  const stepEvents = newSeq[step] || [];

  newSeq[step] = [
    ...stepEvents,
    {
      id: Math.random(),
      type: "chord",
      chordIndex,
      start: true,
      sustain: 1, // lunghezza iniziale: 1 step (solo la cella di start)
    },
  ];

  return newSeq;
}

// ------------------------------------------------------
// CHANGE SUSTAIN
// ------------------------------------------------------
export function changeChordSustain(
  sequence,
  stepIndex,
  chordIndex,
  delta,
  steps = DEFAULT_STEPS
) {
  const newSeq = cloneSequence(sequence);
  const maxSteps = ensureSteps(steps);

  const stepEvents = newSeq[stepIndex] || [];
  const startObj = stepEvents.find(
    (ev) =>
      ev.type === "chord" &&
      ev.chordIndex === chordIndex &&
      ev.start
  );

  // If no chord start is found, do nothing
  if (!startObj) return sequence;

  const id = startObj.id;

  // 1️. Calculate the CURRENT sustain length by scanning forward
  let currentLen = 1; // includes the start cell
  for (let i = stepIndex + 1; i < maxSteps; i++) {
    const evs = newSeq[i] || [];
    const hasSustain = evs.some(
      (ev) =>
        ev.type === "chord" &&
        ev.chordIndex === chordIndex &&
        ev.id === id &&
        !ev.start
    );
    if (!hasSustain) break;
    currentLen++;
  }

  // 2️. Compute the NEW length (with min/max bounds)
  let newLen = currentLen + delta;
  if (newLen < 1) newLen = 1;

  // Hard stop when another chord is encountered
  const hardLimit = (() => {
    for (let i = stepIndex + 1; i < maxSteps; i++) {
      const evs = newSeq[i] || [];
      const hasOtherChord = evs.some(
        (ev) => ev.type === "chord" && ev.id !== id
      );
      if (hasOtherChord) return i - stepIndex;
    }
    return maxSteps - stepIndex;
  })();

  if (newLen > hardLimit) newLen = hardLimit;

  // 3️. Remove ALL existing sustain cells for this chord
  for (let i = stepIndex + 1; i < maxSteps; i++) {
    const evs = newSeq[i] || [];
    if (!evs.length) continue;

    newSeq[i] = evs.filter(
      (ev) => !(ev.type === "chord" && ev.id === id && !ev.start)
    );
  }

  // 4️. Add new sustain cells ONLY on empty steps
  for (let offset = 1; offset < newLen; offset++) {
    const s = stepIndex + offset;
    if (s >= maxSteps) break;

    const evs = newSeq[s] || [];

    // Stop immediately if any chord already exists on this step
    const hasAnyChord = evs.some((ev) => ev.type === "chord");
    if (hasAnyChord) break;

    newSeq[s] = [
      ...evs,
      {
        id,
        type: "chord",
        chordIndex,
        start: false,
      },
    ];
  }

  // 5️. Update the numeric sustain value on the start cell
  startObj.sustain = newLen;

  return newSeq;
}

export function clearChordSustainFromStep(
  sequence,
  step,
  chordId,
  steps = DEFAULT_STEPS
) {
  const newSeq = cloneSequence(sequence);
  const maxSteps = ensureSteps(steps);

  for (let i = step; i < maxSteps; i++) {
    const events = newSeq[i] || [];
    const filtered = events.filter(
      (ev) =>
        !(
          ev.type === "chord" &&
          ev.id === chordId &&
          !ev.start
        )
    );
    if (filtered.length === events.length) break;
    newSeq[i] = filtered;
  }

  let startStep = null;
  for (let i = step - 1; i >= 0; i--) {
    const events = newSeq[i] || [];
    if (
      events.some(
        (ev) => ev.type === "chord" && ev.id === chordId && ev.start
      )
    ) {
      startStep = i;
      break;
    }
  }

  if (startStep !== null) {
    const events = newSeq[startStep] || [];
    const startObj = events.find(
      (ev) => ev.type === "chord" && ev.id === chordId && ev.start
    );

    if (startObj) {
      let newSustain = 1;
      for (let i = startStep + 1; i < maxSteps; i++) {
        const stepEvents = newSeq[i] || [];
        const hasSustain = stepEvents.some(
          (ev) =>
            ev.type === "chord" &&
            ev.id === chordId &&
            !ev.start
        );
        if (!hasSustain) break;
        newSustain++;
      }
      startObj.sustain = newSustain;
    }
  }

  return newSeq;
}
// ------------------------------------------------------
// REMOVE CHORD (start + sustain)
// ------------------------------------------------------
export function removeChordEvent(
  sequence,
  step,
  chordIndex,
  steps = DEFAULT_STEPS
) {
  const newSeq = cloneSequence(sequence);
  const maxSteps = ensureSteps(steps);

  const startEvents = newSeq[step] || [];
  const startObj = startEvents.find(
    (ev) =>
      ev.type === "chord" &&
      ev.chordIndex === chordIndex &&
      ev.start
  );
  if (!startObj) return sequence;

  const id = startObj.id;

  // Rimuovi lo start
  newSeq[step] = startEvents.filter((ev) => ev.id !== id);

  // Rimuovi la "scia" di sustain
  for (let i = step + 1; i < maxSteps; i++) {
    const stepEvents = newSeq[i] || [];
    if (!stepEvents.length) continue;

    const had = stepEvents.some((ev) => ev.id === id);
    if (!had) break;

    newSeq[i] = stepEvents.filter((ev) => ev.id !== id);
  }

  return newSeq;
}
// ------------------------------------------------------
// APPLICA LA RIMOZIONE DI UN ACCORDO ALLA SEQUENCE
// (rimuove tutti gli eventi di quell'accordo
//  e shifta gli indici > removedIndex)
// ------------------------------------------------------
export function applyChordDeletionToSequence(sequence, removedIndex) {
  const newSeq = cloneSequence(sequence);

  for (let step = 0; step < newSeq.length; step++) {
    const events = newSeq[step] || [];
    if (!events.length) continue;

    const updated = [];

    for (const ev of events) {
      if (ev.type !== "chord") {
        updated.push(ev);
        continue;
      }

      // 1) se puntava all'accordo rimosso → lo elimino
      if (ev.chordIndex === removedIndex) {
        continue;
      }

      // 2) se puntava a un accordo dopo quello rimosso → shift -1
      if (ev.chordIndex > removedIndex) {
        updated.push({ ...ev, chordIndex: ev.chordIndex - 1 });
      } else {
        // 3) altrimenti lo tengo così com'è
        updated.push(ev);
      }
    }

    newSeq[step] = updated;
  }

  return newSeq;
}

/**
 * Creates a serializable snapshot of the current sequencer state.
 *
 * This function converts the internal sequence structure into a simpler format
 * that can be saved, copied, exported, or restored later.
 *
 * Internal sequence format:
 * - sequence[stepIndex] is an array of events for that step.
 * - Each event can be a drum event or a chord event.
 *
 * Snapshot format:
 * - One object per step.
 * - `drums` stores one boolean value for each drum track.
 * - `chords` stores simplified chord-event data.
 *
 * @param {Object} params
 * @param {Array[]} params.sequence
 * The full sequencer event array. Each index represents one sequencer step.
 *
 * @param {number} params.steps
 * Number of steps that should be included in the snapshot.
 *
 * @returns {Array<Object>}
 * Serializable array containing one entry per sequencer step.
 */
export function getSequencerSnapshot({ sequence, steps = DEFAULT_STEPS }) {
  
  /**
  * Defensive version of the incoming sequence.
  *
  * If the caller passes invalid sequence data, this falls back to an empty array
  * so the snapshot builder can continue without throwing runtime errors.
  */
  const safeSequence = Array.isArray(sequence) ? sequence : [];
  
  /**
  * Validated number of steps to export.
  *
  * If `steps` is not a positive finite number, DEFAULT_STEPS is used instead.
  * This prevents invalid array lengths when building the snapshot.
  */
  const stepCount =
    Number.isFinite(steps) && steps > 0 ? steps : DEFAULT_STEPS;

  return Array.from({ length: stepCount }, (_, stepIndex) => {
    
    /**
    * Events stored at the current step.
    *
    * If the current step does not contain a valid event array, it is treated as
    * empty. This keeps the export logic safe even when sequence data is partial.
    */
    const events = Array.isArray(safeSequence[stepIndex])
      ? safeSequence[stepIndex]
      : [];
    
    /**
    * Drum activation map for the current step.
    *
    * For every known drum id, this checks whether the current step contains a
    * matching drum event.
    *
    * Example result:
    * {
    *   kick: true,
    *   snare: false,
    *   hihat: true,
    *   openhat: false
    * }
    */
    const drums = DRUM_IDS.reduce((acc, drumId) => {
      acc[drumId] = events.some(
        (ev) => ev.type === "drum" && ev.drum === drumId
      );
      return acc;
    }, {});
    
    /**
    * Chord events for the current step.
    *
    * Only chord-related fields required for reconstruction are exported:
    * - id: original chord event id
    * - chordIndex: index of the chord inside the chord library
    * - start: whether this event is the beginning of a chord
    * - sustain: sustain length, only stored on chord-start events
    */
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

/**
 * Rebuilds the internal sequencer event structure from a saved snapshot.
 *
 * This performs the inverse operation of `getSequencerSnapshot`.
 * It receives simplified step data and reconstructs the event arrays used by
 * the sequencer UI and playback logic.
 *
 * @param {Array<Object>} snapshot
 * Previously exported sequencer snapshot.
 *
 * @param {number} steps
 * Number of sequencer steps to rebuild.
 *
 * @returns {Array[]}
 * Internal sequence array. Each index contains the events for that step.
 */
export function buildSequenceFromSnapshot(snapshot, steps = DEFAULT_STEPS) {
  /**
  * Defensive version of the incoming snapshot.
  *
  * Invalid snapshot data is treated as an empty array so the reconstruction
  * process remains safe.
  */
  const safeSnapshot = Array.isArray(snapshot) ? snapshot : [];
  const stepCount =
    Number.isFinite(steps) && steps > 0 ? steps : DEFAULT_STEPS;

  return Array.from({ length: stepCount }, (_, stepIndex) => {
    /**
    * Snapshot data for the current step.
    *
    * If the snapshot does not contain data for this step, an empty object is used.
    */
    const entry = safeSnapshot[stepIndex] || {};
    const drums = entry.drums || {};
    const chordRows = Array.isArray(entry.chords) ? entry.chords : [];

    /**
    * Internal event list reconstructed for the current step.
    *
    * Drum events and chord events are pushed into this array, then returned as
    * the value for sequence[stepIndex].
    */
    const events = [];
    
    /**
    * Rebuild drum events for this step.
    *
    * A drum event is created for each drum id whose snapshot value is true.
    * The generated id only needs to be unique enough for rendering and event
    * distinction inside the sequencer.
    */
    for (const drumId of DRUM_IDS) {
      if (drums[drumId]) {
        events.push({
          id: `drum-${stepIndex}-${drumId}-${Math.random().toString(36)}`,
          type: "drum",
          drum: drumId,
        });
      }
    }

    /**
    * Rebuild chord events for this step.
    *
    * Invalid chord snapshot entries are ignored. Valid entries are converted back
    * into the internal chord-event format expected by the sequencer.
    */
    for (const chord of chordRows) {
      if (!chord || typeof chord !== "object") continue;
      const { id, chordIndex, start, sustain } = chord;
      
      /**
      * Internal chord event reconstructed from snapshot data.
      *
      * Variables:
      * - id: original event id if available; otherwise a fallback id is generated.
      * - type: always "chord" for chord events.
      * - chordIndex: index into the chord library, or null if invalid.
      * - start: true if this event is the beginning of a chord.
      * - sustain: optional sustain length, only valid on chord-start events.
      */
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
