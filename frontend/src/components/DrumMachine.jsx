import { useState } from "react";
import "./DrumMachine.css";

export default function DrumMachine({ onDrumSequenceChange }) {
  const STEPS = 16;

  const DRUMS = [
    { label: "Kick", id: "kick" },
    { label: "Snare", id: "snare" },
    { label: "HiHat", id: "hihat" },
  ];

  // sequence[stepIndex] = array di eventi drum
  const [sequence, setSequence] = useState(
    Array.from({ length: STEPS }, () => [])
  );

  const toggleDrum = (stepIndex, drumId) => {
    setSequence(prev => {
      const newSeq = prev.map(s => [...s]);

      const exists = newSeq[stepIndex].some(
        ev => ev.type === "drum" && ev.drum === drumId
      );

      if (exists) {
        newSeq[stepIndex] = newSeq[stepIndex].filter(
          ev => !(ev.type === "drum" && ev.drum === drumId)
        );
      } else {
        newSeq[stepIndex].push({
          id: Math.random().toString(36).substr(2, 9),
          type: "drum",
          drum: drumId,
          start: true,
        });
      }

      onDrumSequenceChange?.(newSeq);
      return newSeq;
    });
  };

  return (
    <div className="drum-container">
      <h2>Drum Machine</h2>

      {/* ⚠️ NUOVA GRID IN STILE SEQUENCER, MA ORIENTATA A STRUMENTI=RIGHE */}
      <div className="drum-grid">

        {/* Header degli step */}
        <div className="drum-row drum-header">
          <div className="drum-cell drum-header-cell"></div>

          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className="drum-cell drum-header-cell">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Strumenti come RIGHE */}
        {DRUMS.map(drum => (
          <div key={drum.id} className="drum-row">
            {/* Nome strumento */}
            <div className="drum-cell drum-name">{drum.label}</div>

            {/* Celle step */}
            {Array.from({ length: STEPS }).map((_, stepIndex) => {
              const active = sequence[stepIndex].some(
                ev => ev.type === "drum" && ev.drum === drum.id
              );

              return (
                <div
                  key={stepIndex}
                  className={`drum-cell drum-step ${active ? "active" : ""}`}
                  onClick={() => toggleDrum(stepIndex, drum.id)}
                ></div>
              );
            })}
          </div>
        ))}

      </div>
    </div>
  );
}
