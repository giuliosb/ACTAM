// sequenceUtils.js
import { STEPS } from "./musicConfig";

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
// TODO: CHANGE THIS (it works even if there is another step, it goes over the not sustained one  S----NS-   NS )
export function changeChordSustain(sequence, stepIndex, chordIndex, delta) {
  const newSeq = cloneSequence(sequence);

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
  for (let i = stepIndex + 1; i < STEPS; i++) {
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
    for (let i = stepIndex + 1; i < STEPS; i++) {
      const evs = newSeq[i] || [];
      const hasOtherChord = evs.some(
        (ev) => ev.type === "chord" && ev.id !== id
      );
      if (hasOtherChord) return i - stepIndex;
    }
    return STEPS - stepIndex;
  })();

  if (newLen > hardLimit) newLen = hardLimit;

  // 3️. Remove ALL existing sustain cells for this chord
  for (let i = stepIndex + 1; i < STEPS; i++) {
    const evs = newSeq[i] || [];
    if (!evs.length) continue;

    newSeq[i] = evs.filter(
      (ev) => !(ev.type === "chord" && ev.id === id && !ev.start)
    );
  }

  // 4️. Add new sustain cells ONLY on empty steps
  for (let offset = 1; offset < newLen; offset++) {
    const s = stepIndex + offset;
    if (s >= STEPS) break;

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



// ------------------------------------------------------
// REMOVE CHORD (start + sustain)
// ------------------------------------------------------
export function removeChordEvent(sequence, step, chordIndex) {
  const newSeq = cloneSequence(sequence);

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
  for (let i = step + 1; i < STEPS; i++) {
    const stepEvents = newSeq[i] || [];
    if (!stepEvents.length) continue;

    const had = stepEvents.some((ev) => ev.id === id);
    if (!had) break;

    newSeq[i] = stepEvents.filter((ev) => ev.id !== id);
  }

  return newSeq;
}
