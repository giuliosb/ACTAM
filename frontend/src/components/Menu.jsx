import React from "react";

export default function Menu({ onSelect }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "20px",
      padding: "20px",
      border: "1px solid #ccc",
      borderRadius: "8px",
      background: "#f0f0f0",
      width: "300px",
      margin: "auto",
      marginTop: "40px"
    }}>
      <h2>Menu</h2>
      <button
        style={{ padding: "10px 20px" }}
        onClick={() => onSelect("generated")}
      >
        Generated Accompaniment
      </button>
      <button
        style={{ padding: "10px 20px" }}
        onClick={() => onSelect("audio")}
      >
        Audio Accompaniment
      </button>
    </div>
  );
}
