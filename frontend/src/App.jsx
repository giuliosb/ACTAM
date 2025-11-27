import { useState } from "react";
import "./App.css";

import Menu from "./components/Menu";
import GeneratedAccompaniment from "./components/GeneratedAccompaniment";
import AudioProcessor from "./components/AudioProcessor";
import ShowKnobs from "./components/ShowKnobs";

function App() {
  const [currentCard, setCurrentCard] = useState("menu"); // menu | generated | audio

  const renderCard = () => {
    switch (currentCard) {
      case "generated":
        return <GeneratedAccompaniment />;
      case "audio":
        return <ShowKnobs />;
      case "menu":
      default:
        return <Menu onSelect={setCurrentCard} />;
    }
  };

  return (
    <div className="App" style={{ padding: "20px", fontFamily: "sans-serif" }}>
      {/* Card container */}
      <div style={{ minHeight: "600px" }}>
        {renderCard()}
      </div>

      {/* Always available navigation panel */}
      {currentCard !== "menu" && (
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            onClick={() => setCurrentCard("menu")}
            style={{ padding: "10px 20px", marginRight: "10px" }}
          >
            Back to Menu
          </button>
          {currentCard !== "generated" && (
            <button
              onClick={() => setCurrentCard("generated")}
              style={{ padding: "10px 20px", marginRight: "10px" }}
            >
              Generated Accompaniment
            </button>
          )}
          {currentCard !== "audio" && (
            <button
              onClick={() => setCurrentCard("audio")}
              style={{ padding: "10px 20px" }}
            >
              Audio Accompaniment
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
