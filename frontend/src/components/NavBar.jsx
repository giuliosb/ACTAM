import React from "react";

const baseLinkStyle = {
  padding: "10px 20px",
  textDecoration: "none",
  color: "#fff",
  fontWeight: 500,
  textAlign: "center",
};

export default function NavBar({ onSelect, currentCard }) {
  return (
    <nav style={{ 
      top: 0,
      width: "100%", 
      zIndex: 1, 
      // backgroundColor: "#121214", 
      textAlign: "center",
      paddingBottom: "1.0rem",
      paddingTop: "1.0rem",
      border: "2px solid #e0e0e0,",
      borderRadius: "0px"
      }
      }>
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        <a
          href="#generated"
          style={{
            ...baseLinkStyle,
            color: currentCard === "generated" ? "#bebebe" : "#e0e0e0",
          }}
          onClick={() => onSelect("generated")}
        >
          MUSIC SEQUENCER
        </a>
        <a
          href="#audio"
          style={{
            ...baseLinkStyle,
            color: currentCard === "audio" ? "#bebebe" : "#e0e0e0",
          }}
          onClick={() => onSelect("audio")}
        >
          AUDIO
          ACCOMPANIMENT
        </a>
      </div>
    </nav>
  );
}
