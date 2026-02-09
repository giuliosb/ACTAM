import { useState, useRef, useEffect } from "react";
import "./Knob.css";

// Degree range for the knob
const START_ANGLE = 225;   // value = 0
const END_ANGLE = 493;     // value = 100
const RANGE = END_ANGLE - START_ANGLE;
const EXTRA_ZERO_DEG = 8; // how far past zero you can turn



export default function Knob({ value = 0, onChange }) {
  const knobRef = useRef(null);
  const [currentValue, setCurrentValue] = useState(value);
  const [currentAngle, setCurrentAngle] = useState(
    START_ANGLE + (value / 100) * RANGE
  );

  const [isDragging, setIsDragging] = useState(false);
  const lastAngle = useRef(null);

  // Keep internal value synced with parent
  useEffect(() => {
    const angle = START_ANGLE + (value / 100) * RANGE;
    setCurrentAngle(angle);
    setCurrentValue(value);
  }, [value]);

  const startDrag = (e) => {
    setIsDragging(true);
    lastAngle.current = getAngleFromMouse(e);
    e.preventDefault();
  };

  const stopDrag = () => {
    setIsDragging(false);
  };

  const getAngleFromMouse = (e) => {
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = angle < 0 ? angle + 360 : angle;

    return angle;
  };

  const onDrag = (e) => {
    if (!isDragging) return;

    const angle = getAngleFromMouse(e);
    let delta = angle - lastAngle.current;

    // make large jumps smooth (angle wraparound)
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // drag sensitivity → lower = smoother
    const sensitivity = 0.84;
    const newAngle = currentAngle + delta * sensitivity;



    // clamp angle
    const clamped = Math.min(
        END_ANGLE,
        Math.max(START_ANGLE - EXTRA_ZERO_DEG, newAngle)
      );
      

    setCurrentAngle(clamped);
    lastAngle.current = angle;

    // convert to value
    const valueAngle = Math.max(clamped, START_ANGLE);
    const newValue = ((valueAngle - START_ANGLE) / RANGE) * 100;



    setCurrentValue(newValue);
    onChange?.(newValue);
  };

  return (
    <div
      className="knob-wrapper"
      onMouseDown={startDrag}
      onMouseMove={onDrag}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      {/* Ticks only from START_ANGLE to END_ANGLE */}
      <div className="ticks">
        {Array.from({ length: 20 }).map((_, i) => {
            const tickAngle = START_ANGLE + (i / 19) * RANGE; // 19 = 20 - 1
            const isActive = currentValue == 100 ? true : i < (currentValue / 100) * 19;

            return (
            <div
                key={i}
                className={`tick ${isActive ? "active" : ""}`}
                style={{ transform: `rotate(${tickAngle}deg)` }}
            ></div>
            );
        })}
       </div>

      <div
        className="knob"
        ref={knobRef}
        style={{
          transform: `rotate(${currentAngle}deg)`
        }}
      >
        <div className="indicator"></div>
      </div>
    </div>
  );
}
