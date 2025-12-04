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
export function changeChordSustain(sequence, stepIndex, chordIndex, delta) {
  const newSeq = cloneSequence(sequence);

  const stepEvents = newSeq[stepIndex] || [];
  const startObj = stepEvents.find(
    (ev) =>
      ev.type === "chord" &&
      ev.chordIndex === chordIndex &&
      ev.start
  );

  // Se non troviamo lo start, non facciamo niente
  if (!startObj) return sequence;

  const id = startObj.id;

  // 1️⃣ Calcola la lunghezza ATTUALE scorrendo in avanti
  //    (così siamo sicuri che sia coerente con le celle di sustain esistenti)
  let currentLen = 1; // almeno la cella di start
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

  // 2️⃣ Nuova lunghezza (= vecchia + delta), clampata tra 1 e fine griglia
  let newLen = currentLen + delta;
  if (newLen < 1) newLen = 1;

  const maxLen = STEPS - stepIndex;
  if (newLen > maxLen) newLen = maxLen;

  // 3️⃣ Rimuovi TUTTE le celle di sustain per questo accordo (dallo step successivo in poi)
  for (let i = stepIndex + 1; i < STEPS; i++) {
    const evs = newSeq[i] || [];
    if (!evs.length) continue;

    newSeq[i] = evs.filter(
      (ev) => !(ev.type === "chord" && ev.id === id && !ev.start)
    );
  }

  // 4️⃣ Aggiungi le nuove celle di sustain:
  //     newLen = 1 → nessuna cella extra
  //     newLen = 2 → 1 cella (stepIndex + 1)
  //     newLen = 3 → 2 celle (stepIndex + 1, stepIndex + 2), ecc.
  for (let offset = 1; offset < newLen; offset++) {
    const s = stepIndex + offset;
    if (s >= STEPS) break;

    const evs = newSeq[s] || [];
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

  // 5️⃣ Aggiorna anche il valore numerico di sustain sullo start
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
