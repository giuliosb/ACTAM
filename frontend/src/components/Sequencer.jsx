import { useState, useEffect, useRef } from "react";
import "./Sequencer.css";

export default function Sequencer({ chords = [], onSequenceChange }) {
  const STEPS = 16;
  const [sequence, setSequence] = useState(Array(STEPS).fill([]));
  const [isDragging, setIsDragging] = useState(false);
  const [dragChord, setDragChord] = useState(null);
  const dragStartStep = useRef(null);

  useEffect(() => {
    // Aggiorna la sequenza se cambiano gli accordi
    setSequence(prev => prev.map(step => step.filter(s => s.chordIndex < chords.length)));
  }, [chords]);

  const handleMouseDown = (stepIndex, chordIndex) => {
    setIsDragging(true);
    setDragChord(chordIndex);
    dragStartStep.current = stepIndex;
  };

  const handleMouseOver = (stepIndex) => {
    if (!isDragging || dragChord === null) return;

    const start = dragStartStep.current;
    const end = stepIndex;
    const from = Math.min(start, end);
    const to = Math.max(start, end);

    setSequence(prev => {
      const newSeq = [...prev];

      // Rimuovi eventuali precedenti dello stesso accordo
      newSeq.forEach((s, i) => {
        newSeq[i] = s.filter(obj => obj.chordIndex !== dragChord);
      });

      // Aggiungi sustain sull'intervallo
      for (let i = from; i <= to; i++) {
        newSeq[i].push({ chordIndex: dragChord, sustain: to - i + 1 });
      }

      if (onSequenceChange) onSequenceChange(newSeq);
      return newSeq;
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragChord(null);
    dragStartStep.current = null;
  };

  return (
    <div className="sequencer-container" onMouseUp={handleMouseUp}>
      <h2>Chord Sequencer</h2>

      <div className="grid">
        {/* Header colonne */}
        <div className="grid-row header">
          <div className="grid-cell header-cell"></div>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className="grid-cell header-cell">{i + 1}</div>
          ))}
        </div>

        {/* Righe accordi */}
        {chords.map((chord, chordIndex) => (
          <div key={chordIndex} className="grid-row">
            <div className="grid-cell chord-name">
              {chord.root} {chord.triad} {chord.extension}
            </div>

            {Array.from({ length: STEPS }).map((_, stepIndex) => {
              const cellActive = sequence[stepIndex]?.some(obj => obj.chordIndex === chordIndex);
              return (
                <div
                  key={stepIndex}
                  className={`grid-cell step-cell ${cellActive ? "active" : ""}`}
                  onMouseDown={() => handleMouseDown(stepIndex, chordIndex)}
                  onMouseOver={() => handleMouseOver(stepIndex)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="debug-box">
        <h3>Sequence Data:</h3>
        <pre>{JSON.stringify(sequence, null, 2)}</pre>
      </div>
    </div>
  );
}
