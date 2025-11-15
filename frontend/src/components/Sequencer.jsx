import { useState, useEffect } from "react";
import "./Sequencer.css";

export default function Sequencer({ chords = [], onSequenceChange }) {
  const STEPS = 16;

  const [sequence, setSequence] = useState(
    Array.from({ length: STEPS }, () => [])
  );

  const generateId = () => Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    setSequence(prev =>
      prev.map(step => step.filter(obj => obj.chordIndex < chords.length))
    );
  }, [chords]);

  const addChordAtStep = (stepIndex, chordIndex) => {
    setSequence(prev => {
      const newSeq = prev.map(arr => [...arr]);
      if (!newSeq[stepIndex].some(o => o.chordIndex === chordIndex && o.start)) {
        const id = generateId();
        newSeq[stepIndex].push({ id, chordIndex, start: true, sustain: 1 });
      }
      onSequenceChange?.(newSeq);
      return newSeq;
    });
  };

  const changeSustain = (stepIndex, chordIndex, delta) => {
    setSequence(prev => {
      const newSeq = prev.map(step => step.map(obj => ({ ...obj })));

      const startObj = newSeq[stepIndex].find(o => o.chordIndex === chordIndex && o.start);
      if (!startObj) return prev;

      const oldSustain = startObj.sustain;
      const newSustain = Math.max(1, oldSustain + delta);
      startObj.sustain = newSustain;

      const chordId = startObj.id;

      // Rimuovo tutti i sustain associati a questo id
      for (let i = 0; i < STEPS; i++) {
        const idx = newSeq[i].findIndex(o => o.id === chordId && !o.start);
        if (idx !== -1) newSeq[i].splice(idx, 1);
      }

      // Aggiungo sustain in base al nuovo valore
      for (let i = stepIndex + 1; i < stepIndex + newSustain && i < STEPS; i++) {
        newSeq[i].push({ id: chordId, chordIndex, start: false });
      }

      onSequenceChange?.(newSeq);
      return newSeq;
    });
  };

  const removeChordAtStep = (stepIndex, chordIndex) => {
    setSequence(prev => {
      const newSeq = prev.map(step => [...step]);
      const startObj = newSeq[stepIndex].find(o => o.chordIndex === chordIndex && o.start);
      if (!startObj) return prev;

      const chordId = startObj.id;

      // Rimuovo tutte le istanze (start + sustain) con questo id
      for (let i = 0; i < STEPS; i++) {
        newSeq[i] = newSeq[i].filter(o => o.id !== chordId);
      }

      onSequenceChange?.(newSeq);
      return newSeq;
    });
  };

  return (
    <div className="sequencer-container">
      <h2>Chord Sequencer</h2>
      <div className="grid">
        <div className="grid-row header">
          <div className="grid-cell header-cell"></div>
          {chords.map((chord, chordIndex) => (
            <div key={chordIndex} className="grid-cell header-cell">
              {chord.root} {chord.triad} {chord.extension}
            </div>
          ))}
        </div>

        {Array.from({ length: STEPS }).map((_, stepIndex) => (
          <div key={stepIndex} className="grid-row">
            <div className="grid-cell step-name">{stepIndex + 1}</div>
            {chords.map((chord, chordIndex) => {
              const obj = sequence[stepIndex].find(o => o.chordIndex === chordIndex);
              const isStart = obj?.start;
              const style = obj
                ? { backgroundColor: isStart ? "#4caf50" : "#a5d6a7" }
                : {};

              return (
                <div key={chordIndex} className="grid-cell step-cell" style={style}>
                  <div className="cell-buttons">
                    {!obj && <button onClick={() => addChordAtStep(stepIndex, chordIndex)}>+</button>}
                    {isStart && (
                      <>
                        <button onClick={() => changeSustain(stepIndex, chordIndex, 1)}>+</button>
                        <button onClick={() => changeSustain(stepIndex, chordIndex, -1)}>-</button>
                        <button onClick={() => removeChordAtStep(stepIndex, chordIndex)}>x</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
