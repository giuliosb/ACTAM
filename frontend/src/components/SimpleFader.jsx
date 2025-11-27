import { useRef, useState } from "react";
import "./SimpleFader.css";

export default function SimpleFader({
  initialValue = 50,
  dB = false,
  min = -15,
  max = 15,
  onChange
}) {
  const trackRef = useRef(null);
  const [value, setValue] = useState(initialValue);

  const handleMove = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percent = 1 - y / rect.height;

    let v = Math.max(0, Math.min(1, percent)) * 100;

    if (dB) {
      v = Math.pow(v / 100, 2) * 100;
    }

    setValue(v);
    onChange?.(v);
  };

  return (
    <div className="fader-wrapper">
      {/* Scale */}
      <div className="fader-scale">
        <span>+{max}</span>
        <span>{min}</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="fader-track"
        onMouseDown={handleMove}
        onMouseMove={(e) => e.buttons === 1 && handleMove(e)}
      >
        <div
          className="fader-handle"
          style={{ top: `${100 - value}%` }}
        />
      </div>
    </div>
  );
}
