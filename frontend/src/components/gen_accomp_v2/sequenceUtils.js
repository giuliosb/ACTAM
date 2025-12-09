// sequenceUtils.js
import { DEFAULT_STEPS } from "./musicConfig";

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
