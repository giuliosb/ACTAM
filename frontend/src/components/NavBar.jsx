import React from "react";
import Switch from "./general_components/Switch.jsx";


export default function NavBar({ onSelect, currentCard }) {
  const switchTarget = currentCard === "generated" ? "audio" : "generated";

  const handleKeySelect =
    (target) =>
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(target);
      }
    };

  return (
    <nav
      style={{
        top: 0,
        width: "100%",
        zIndex: 1,
        // backgroundColor: "#121214",
        textAlign: "center",
        paddingBottom: "1.0rem",
        paddingTop: "1.0rem",
        border: "2px solid #e0e0e0",
        borderRadius: "0px",
        minWidth: 900,
        overflowX: "auto",
      }}
    >
      <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.8rem",
        }}>
        <h3>
          MUSIC SEQUENCER
        </h3>
        <Switch
          horizontal={true}
          size={130}
          onToggle={() => onSelect(switchTarget)}
        />
        <h3>
          AUDIO ACCOMPANIMENT
        </h3>
      </div>
    </nav>
  );
}
