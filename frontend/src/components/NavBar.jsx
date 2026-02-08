import React from "react";
import Switch from "./general_components/Switch.jsx";
import Indicator from "./general_components/Indicator.jsx";
import "./NavBar.css";

export default function NavBar({ onSelect, currentCard }) {
  const switchTarget = currentCard === "generated" ? "audio" : "generated";

  return (
    <nav className="navbar">
      <div className="navbar-row">
        <div className="navbar-side left">
          <Indicator on={currentCard === "generated"} />
          <h3 className="navbar-title">MUSIC SEQUENCER</h3>
        </div>

        <div className="navbar-center">
          <Switch horizontal size={130} onToggle={() => onSelect(switchTarget)} />
        </div>

        <div className="navbar-side right">
          <h3 className="navbar-title">AUDIO ACCOMPANIMENT</h3>
          <Indicator on={currentCard === "audio"} />
        </div>
      </div>
    </nav>

  );
}
