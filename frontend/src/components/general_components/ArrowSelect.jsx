import { useState, useEffect } from "react";
import "./ArrowSelect.css";

export default function ArrowSelect({
  id,
  options = [],
  value,
  onChange,
  getLabel,
  getValue,
}) {
  if (!options.length) return null;

  const _getValue =
    getValue || ((o) => (typeof o === "string" ? o : o.value ?? o.id));
  const _getLabel =
    getLabel || ((o) => (typeof o === "string" ? o : o.label ?? String(_getValue(o))));

  const values = options.map(_getValue);
  const currentIndex = Math.max(0, values.indexOf(value));

  const prev = () => {
    const nextIndex = currentIndex === 0 ? options.length - 1 : currentIndex - 1;
    onChange(_getValue(options[nextIndex]));
  };

  const next = () => {
    const nextIndex = currentIndex === options.length - 1 ? 0 : currentIndex + 1;
    onChange(_getValue(options[nextIndex]));
  };

  return (
    
    <div id={id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button className='buttonPixelFont button' onClick={prev} aria-label="Previous">&lt;</button>
      <div className='middle'>{_getLabel(options[currentIndex])}</div>
      <button className='buttonPixelFont button' onClick={next} aria-label="Next">&gt;</button>      
    </div>
  );
}
