import { useState, useEffect } from "react";
import "./Sequencer.css";

export default function Sequencer({ chords = [], onSequenceChange }) {
  const STEPS = 16;

  // Ogni step è un array di oggetti { chordIndex, start, sustain }
  const [sequence, setSequence] = useState(Array.from({ length: STEPS }, () => []));

  // Sincronizza la sequence con i nuovi accordi (rimuove riferimenti invalidi)
  useEffect(() => {
    setSequence(prev =>
      prev.map(step =>
        step.filter(obj => obj.chordIndex < chords.length)
      )
    );
  }, [chords]);

  // Aggiunge un accordo a uno step
  const addChordAtStep = (stepIndex, chordIndex) => {
    setSequence(prev => {
      const newSeq = prev.map(arr => [...arr]);
      if (!newSeq[stepIndex].some(o => o.chordIndex === chordIndex)) {
        newSeq[stepIndex].push({ chordIndex, start: true, sustain: 1 });
      }
      onSequenceChange?.(newSeq);
      return newSeq;
    });
  };

  // Cambia il sustain di un accordo
  const changeSustain = (stepIndex, chordIndex, delta) => {
  setSequence(prev => {
    // copia profonda per sicurezza
    const newSeq = prev.map(step => step.map(obj => ({ ...obj })));

    const startObj = newSeq[stepIndex].find(o => o.chordIndex === chordIndex && o.start);
    if (!startObj) return prev;

    const oldSustain = startObj.sustain;
    const newSustain = Math.max(1, oldSustain + delta);
    startObj.sustain = newSustain;

    for (let i = stepIndex + 1; i < STEPS; i++) {
      const stepArr = newSeq[i];
      const sustainObjIndex = stepArr.findIndex(o => o.chordIndex === chordIndex && !o.start);

      if (i < stepIndex + newSustain) {
        // dentro la nuova lunghezza → aggiungi sustain se non c’è
        if (sustainObjIndex === -1) stepArr.push({ chordIndex, start: false });
      } else {
        // oltre il sustain → rimuovi sustain
        if (sustainObjIndex !== -1) stepArr.splice(sustainObjIndex, 1);
      }
    }

    onSequenceChange?.(newSeq);
    return newSeq;
  });
};


  // Rimuove un accordo e tutto il suo sustain
  const removeChordAtStep = (stepIndex, chordIndex) => {
    setSequence(prev => {
      const newSeq = prev.map(step => step.filter(o => o.chordIndex !== chordIndex));
      onSequenceChange?.(newSeq);
      return newSeq;
    });
  };

  return (
    <div className="sequencer-container">
      <h2>Chord Sequencer</h2>

      <div className="grid">
        {/* Header */}
        <div className="grid-row header">
          <div className="grid-cell header-cell"></div>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className="grid-cell header-cell">{i + 1}</div>
          ))}
        </div>

        {/* Righe per accordi */}
        {chords.map((chord, chordIndex) => (
          <div key={chordIndex} className="grid-row">
            <div className="grid-cell chord-name">{chord.root} {chord.triad} {chord.extension}</div>

            {Array.from({ length: STEPS }).map((_, stepIndex) => {
              const obj = sequence[stepIndex].find(o => o.chordIndex === chordIndex);
              const isStart = obj?.start;
              const style = obj
                ? { backgroundColor: isStart ? "#4caf50" : "#a5d6a7" }
                : {};

              return (
                <div key={stepIndex} className="grid-cell step-cell" style={style}>
                  {!obj && <button onClick={() => addChordAtStep(stepIndex, chordIndex)}>+</button>}
                  {isStart && (
                    <>
                      <button onClick={() => changeSustain(stepIndex, chordIndex, 1)}>+</button>
                      <button onClick={() => changeSustain(stepIndex, chordIndex, -1)}>-</button>
                      <button onClick={() => removeChordAtStep(stepIndex, chordIndex)}>x</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Debug */}
      <div className="debug-box">
        <pre>{JSON.stringify(sequence, null, 2)}</pre>
      </div>
    </div>
  );
}
