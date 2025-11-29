import { useRef, useState, useEffect, useCallback } from "react";
import "./Slider.css";

const BAR_HEIGHT = 12;
const SLOT_PADDING = 6;
const TRACK_HEIGHT = 180; // matches .slider-track height

export default function Slider({
  value = 50,
  onChange = () => {},
  dB = false,
  center = false, 
  min = -15,
  max = 15,
}) {
  const trackRef = useRef(null);
  const [pos, setPos] = useState(value); // 0–100

  // --- LOGIC -------------------------------------------------------------

  const linearToLog = (v) => {
    const x = v / 100;
    return Math.pow(x, 2) * 100;
  };
  
  const linearToCenteredLog = (v) => {
    if (v === 50) return 50;
  
    if (v > 50) {
      // 50 → 100 (log up)
      const x = (v - 50) / 50;        // 0 → 1
      return 50 + Math.pow(x, 2) * 50;
    } else {
      // 50 → 0 (log down)
      const x = (50 - v) / 50;        // 0 → 1
      return 50 - Math.pow(x, 2) * 50;
    }
  };
  
  const computeOutput = (v) => {
    if (!dB) return v;
    return center ? linearToCenteredLog(v) : linearToLog(v);
  };
  

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
      let center = clientY;
      center = Math.max(centerMin, Math.min(centerMax, center));

      // map to 0–100 (100 at top, 0 at bottom)
      const v = ((centerMax - center) / range) * 100;

      setPos(v);
      onChange(computeOutput(v));
    },
    [dB, onChange]
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

  useEffect(() => setPos(value), [value]);

  // --- UI ---------------------------------------------------------------

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "30px 1fr",
    columnGap: "10px",
    rowGap: "6px",
  };

  // convert pos (0–100) to px `top` in track coords
  const slotTopTrack = SLOT_PADDING;
  const slotBottomTrack = TRACK_HEIGHT - SLOT_PADDING;
  const centerMinTrack = slotTopTrack + BAR_HEIGHT / 2;
  const centerMaxTrack = slotBottomTrack - BAR_HEIGHT / 2;
  const rangeTrack = centerMaxTrack - centerMinTrack;

  const centerTrack = centerMaxTrack - (pos / 100) * rangeTrack;
  const topPx = centerTrack - BAR_HEIGHT / 2; // slider-bar's top

  return (
    <div>
      <div style={gridStyle}>
        {/* 2nd COLUMN – ticks */}
        <div className="tick-track">
          <div className="ticks">
            <div></div>
            {Array.from({ length: 11 }).map((_, i) => (
              <div className="tick-row" key={i}>
                <div className="tick-line"></div>
              </div>
            ))}
            <div></div>
          </div>
        </div>

        {/* 3rd COLUMN – slider */}
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
