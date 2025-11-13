import { useState } from "react";
import "./Keyboard.css";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function Keyboard() {
  const [a4Frequency, setA4Frequency] = useState(440);

  // frequency calculation
  const noteFrequency = (note, octave) => {
    const n = NOTES.indexOf(note) + (octave - 4) * 12 - 9; // semitone distance from A4
    return a4Frequency * Math.pow(2, n / 12);
  };

  // notes generation
  const keys = [];
  const octaves = [3, 4, 5];
  for (let o of octaves) {
    for (let note of NOTES) {

      if (o === 5 && note === "C") {
        keys.push({ note, octave: o, freq: noteFrequency(note, o) });
        break;
      }
      
      if (!(o === 5 && note !== "C")) {
        keys.push({ note, octave: o, freq: noteFrequency(note, o) });
      }
    }
  }

  return (
    <div>
      <div className="input-container">
        <label>
          Frequenza di A4 (Hz):{" "}
          <input
            type="number"
            value={a4Frequency}
            onChange={(e) => setA4Frequency(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="keyboard">
        {keys.map((key) => (
          <div
            key={`${key.note}${key.octave}`}
            className={`key ${key.note.includes("#") ? "black" : "white"}`}
          >
            {key.note}
            <span className="freq">{key.freq.toFixed(2)} Hz</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Keyboard;
