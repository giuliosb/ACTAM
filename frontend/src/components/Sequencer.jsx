import { useState, useEffect } from "react";
import "./Sequencer.css";

export default function Sequencer({ chords = [], onSequenceChange }) {
  const STEPS = 16;
  const [sequence, setSequence] = useState(Array(STEPS).fill([]));

  useEffect(() => {
    setSequence(prev => prev.map(step => step.filter(s => s.chordIndex < chords.length)));
  }, [chords]);

  const addChordAtStep = (stepIndex, chordIndex) => {
    setSequence(prev => {
      const newSeq = [...prev];
      newSeq[stepIndex] = [...newSeq[stepIndex], { chordIndex, sustain: 1, start: true }];
      if (onSequenceChange) onSequenceChange(newSeq);
      return newSeq;
    });
  };

  const removeSustainAtStep = (stepIndex, chordIndex) => {
    setSequence(prev => {
      const newSeq = [...prev];
      let startStep = null;
      for (let i = 0; i < STEPS; i++) {
        const obj = newSeq[i].find(o => o.chordIndex === chordIndex && o.start);
        if (obj && stepIndex >= i && stepIndex < i + obj.sustain) {
          startStep = i;
          break;
        }
      }
      if (startStep !== null) {
        const sustainObj = newSeq[startStep].find(o => o.chordIndex === chordIndex && o.start);
        for (let i = startStep; i < startStep + sustainObj.sustain && i < STEPS; i++) {
          newSeq[i] = newSeq[i].filter(o => !(o.chordIndex === chordIndex && (i === startStep ? o.start : !o.start)));
        }
      }
      if (onSequenceChange) onSequenceChange(newSeq);
      return newSeq;
    });
  };

  const changeSustain = (startStep, chordIndex, delta) => {
    setSequence(prev => {
      const newSeq = [...prev];
      const startObj = newSeq[startStep].find(o => o.chordIndex === chordIndex && o.start);
      if (!startObj) return newSeq;
      const newLength = Math.max(1, startObj.sustain + delta);
      startObj.sustain = newLength;

      // aggiunge solo le celle di sustain (escluso l'inizio)
      for (let i = startStep + 1; i < startStep + newLength && i < STEPS; i++) {
        if (!newSeq[i].some(o => o.chordIndex === chordIndex)) {
          newSeq[i].push({ chordIndex, start: false });
        }
      }
      // rimuove eventuali vecchie celle in eccesso
      for (let i = startStep + newLength; i < STEPS; i++) {
        newSeq[i] = newSeq[i].filter(o => !(o.chordIndex === chordIndex && !o.start));
      }

      if (onSequenceChange) onSequenceChange(newSeq);
      return newSeq;
    });
  };

  return (
    <div className="sequencer-container">
      <h2>Chord Sequencer</h2>
      <div className="grid">
        <div className="grid-row header">
          <div className="grid-cell header-cell"></div>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className="grid-cell header-cell">{i + 1}</div>
          ))}
        </div>

        {chords.map((chord, chordIndex) => (
          <div key={chordIndex} className="grid-row">
            <div className="grid-cell chord-name">{chord.root} {chord.triad} {chord.extension}</div>

            {Array.from({ length: STEPS }).map((_, stepIndex) => {
              const cellObj = sequence[stepIndex]?.find(obj => obj.chordIndex === chordIndex);
              const isActive = !!cellObj;
              const isStart = cellObj?.start;
              const style = isActive ? { backgroundColor: isStart ? "#4caf50" : "#a5d6a7" } : {};

              return (
                <div key={stepIndex} className={`grid-cell step-cell`} style={style}>
                  {!isActive && <button onClick={() => addChordAtStep(stepIndex, chordIndex)}>+</button>}
                  {isStart && (
                    <>
                      <button onClick={() => changeSustain(stepIndex, chordIndex, 1)}>+</button>
                      <button onClick={() => changeSustain(stepIndex, chordIndex, -1)}>-</button>
                      <button onClick={() => removeSustainAtStep(stepIndex, chordIndex)}>x</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="debug-box">
        <pre>{JSON.stringify(sequence, null, 2)}</pre>
      </div>
    </div>
  );
}
