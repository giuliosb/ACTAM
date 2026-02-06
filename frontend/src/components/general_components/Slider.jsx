import { useRef, useState, useEffect, useCallback } from "react";
import "./Slider.css";

const BAR_HEIGHT = 12;
const SLOT_PADDING = 6;
const TRACK_HEIGHT = 180; // matches .slider-track height

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export default function Slider({
  value = 0, // now expects "real output" value (min..max), not 0..100
  onChange = () => {},
  min = -15,
  max = 15,
  step = 1,
}) {
  const trackRef = useRef(null);

  // Keep the internal state in REAL units (min..max), snapped to step
  const snap = useCallback(
    (x) => {
      const stepped = Math.round(x / step) * step;
      // avoid -0
      const cleaned = Object.is(stepped, -0) ? 0 : stepped;
      return clamp(cleaned, min, max);
    },
    [min, max, step]
  );

  const [out, setOut] = useState(() => snap(value));

  const updateFromPointer = useCallback(
    (clientY) => {
      const rect = trackRef.current.getBoundingClientRect();

      // slot in page coordinates
      const slotTop = rect.top + SLOT_PADDING;
      const slotBottom = rect.bottom - SLOT_PADDING;

      // allowed center range (page coords)
      const centerMin = slotTop + BAR_HEIGHT / 2;
      const centerMax = slotBottom - BAR_HEIGHT / 2;
      const range = centerMax - centerMin;

      // pointer as center, clamped
      let center = clamp(clientY, centerMin, centerMax);

      // percent: 100 at top, 0 at bottom
      const percent = (centerMax - center) / range; // 0..1

      // map directly into min..max
      const rawOut = min + percent * (max - min);

      // snap to real step and clamp
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

  // If parent updates value, snap and reflect it
  useEffect(() => {
    setOut(snap(value));
  }, [value, snap]);

  // --- UI ---------------------------------------------------------------

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "60px 60px",
    columnGap: "8px",
    alignItems: "center",
  };

  // Convert REAL output (min..max) to percent 0..100 for rendering
  const percent01 =
    max === min ? 0 : (out - min) / (max - min); // 0..1
  const pos = clamp(percent01, 0, 1) * 100; // 0..100

  // convert pos (0–100) to px `top` in track coords
  const slotTopTrack = SLOT_PADDING;
  const slotBottomTrack = TRACK_HEIGHT - SLOT_PADDING;
  const centerMinTrack = slotTopTrack + BAR_HEIGHT / 2;
  const centerMaxTrack = slotBottomTrack - BAR_HEIGHT / 2;
  const rangeTrack = centerMaxTrack - centerMinTrack;

  const centerTrack = centerMaxTrack - (pos / 100) * rangeTrack;
  const topPx = centerTrack - BAR_HEIGHT / 2;

  return (
    <div>
      <div className="slider-wrapper" style={gridStyle}>
        {/* ticks */}
        <div className="tick-track">
          <div className="slider-ticks">
            <div></div>
            {Array.from({ length: 11 }).map((_, i) => (
              <div className="tick-row" key={i}>
                <div className="tick-line"></div>
              </div>
            ))}
            <div></div>
          </div>
        </div>

        {/* slider */}
        <div
          className="slider-track"
          ref={trackRef}
          onPointerDown={startDragging}
        >
          <div className="slider-bar" style={{ top: `${topPx}px` }} />
        </div>
      </div>
    </div>
  );
}
