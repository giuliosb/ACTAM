// sequenceUtils.js
import { STEPS } from "./musicConfig";

// Funzione di utilità per copiare la sequenza (copia shallow di ogni step)
const cloneSequence = (sequence) =>
  sequence.map((events) => [...events]);

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
      sustain: 1,
    },
  ];

  return newSeq;
}

// ------------------------------------------------------
// CHANGE SUSTAIN
// ------------------------------------------------------
export function changeChordSustain(sequence, stepIndex, chordIndex, delta) {
  const newSeq = cloneSequence(sequence);

  const startEvents = newSeq[stepIndex];
  const startObj = startEvents.find(
    (ev) =>
      ev.type === "chord" &&
      ev.chordIndex === chordIndex &&
      ev.start
  );
  if (!startObj) return sequence; // nessun cambiamento

  const id = startObj.id;
  const newLen = Math.max(1, startObj.sustain + delta);
  startObj.sustain = newLen;

  // Rimuovi i vecchi sustain
  for (let i = stepIndex + 1; i < STEPS; i++) {
    const stepEvents = newSeq[i];
    const has = stepEvents.some((ev) => ev.id === id);
    if (!has) break;
    newSeq[i] = stepEvents.filter((ev) => ev.id !== id);
  }

  // Aggiungi i nuovi sustain
  for (
    let i = stepIndex + 1;
    i < stepIndex + newLen && i < STEPS;
    i++
  ) {
    const stepEvents = newSeq[i];
    newSeq[i] = [
      ...stepEvents,
      {
        id,
        type: "chord",
        chordIndex,
        start: false,
      },
    ];
  }

  return newSeq;
}

// ------------------------------------------------------
// REMOVE CHORD (start + sustain)
// ------------------------------------------------------
export function removeChordEvent(sequence, step, chordIndex) {
  const newSeq = cloneSequence(sequence);

  const startEvents = newSeq[step];
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
    const stepEvents = newSeq[i];
    const had = stepEvents.some((ev) => ev.id === id);
    if (!had) break;
    newSeq[i] = stepEvents.filter((ev) => ev.id !== id);
  }

  return newSeq;
}
