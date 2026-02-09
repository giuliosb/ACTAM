import { useRef, useState, useEffect, useCallback } from "react";
import "./SliderDigital.css";

// Vertical slider geometry (kept intentionally simple)
const BAR_HEIGHT = 18; // matches .slider-bar-dig height
const TRACK_HEIGHT = 180; // matches .slider-track-dig height

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export default function SliderDigital({
  value = 0, // expects "real output" value (min..max)
  onChange = () => {},
  min = -15,
  max = 15,
  step = 1,
}) {
  const trackRef = useRef(null);

  const snap = useCallback(
    (x) => {
      const stepped = Math.round(x / step) * step;
      const cleaned = Object.is(stepped, -0) ? 0 : stepped;
      return clamp(cleaned, min, max);
    },
    [min, max, step]
  );

  const [out, setOut] = useState(() => snap(value));

  const updateFromPointer = useCallback(
    (clientY) => {
      const rect = trackRef.current.getBoundingClientRect();

      const slotTop = rect.top;
      const slotBottom = rect.bottom;

      const centerMin = slotTop + BAR_HEIGHT / 2; // top
      const centerMax = slotBottom - BAR_HEIGHT / 2; // bottom
      const range = centerMax - centerMin;


      const center = clamp(clientY, centerMin, centerMax);

      // percent: 0 at bottom, 1 at top
      const percent = range === 0 ? 0 : 1 - (center - centerMin) / range;

      const rawOut = min + percent * (max - min);
      const nextOut = snap(rawOut);

      setOut(nextOut);
      onChange(nextOut);
    },
    [min, max, snap, onChange]
  );

  const startDragging = (e) => {
    e.preventDefault();
    const move = (ev) => updateFromPointer(ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    updateFromPointer(e.clientY);
  };

  useEffect(() => {
    setOut(snap(value));
  }, [value, snap]);

  const percent01 = max === min ? 0 : (out - min) / (max - min);
  const pos = clamp(percent01, 0, 1) * 100;

  const slotTopTrack = 0;
  const slotBottomTrack = TRACK_HEIGHT;
  const centerMinTrack = slotTopTrack + BAR_HEIGHT / 2; // top
  const centerMaxTrack = slotBottomTrack - BAR_HEIGHT / 2; // bottom
  const rangeTrack = centerMaxTrack - centerMinTrack;

  // out=min => bottom, out=max => top
  const centerTrack = centerMaxTrack - (pos / 100) * rangeTrack;
  const topPx = centerTrack - BAR_HEIGHT / 2;

  return (
    <div className="slider-wrapper-dig">
      <div
        className="slider-track-dig"
        ref={trackRef}
        onPointerDown={startDragging}
      >
        <div className="slider-bar-dig" style={{ top: `${topPx}px` }} />
      </div>
    </div>
  );
}
