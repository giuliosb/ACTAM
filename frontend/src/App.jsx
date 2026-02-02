import { useState } from "react";
import "./App.css";

import NavBar from "./components/NavBar";
import AudioProcessor from "./components/audio_accomp/AudioProcessor";
import Accompaniment from "./components/gen_accomp_v2/Accompaniment";

function App() {
  const [currentCard, setCurrentCard] = useState("generated"); // generated | audio

  const getVisibilityStyle = (isVisible) => ({
    display: isVisible ? "block" : "none",
    width: "100%",
    height: "100%",
  });

  return (
    <div className="App">
      <NavBar currentCard={currentCard} onSelect={setCurrentCard} />
      {/* Card container */}
      <div style={{ position: "relative", minHeight: "600px" }}>
        <div
          style={getVisibilityStyle(currentCard === "generated")}
          aria-hidden={currentCard !== "generated"}
        >
          <Accompaniment />
        </div>
        <div
          style={getVisibilityStyle(currentCard === "audio")}
          aria-hidden={currentCard !== "audio"}
        >
          <AudioProcessor />
        </div>
      </div>
    </div>
  );
}

export default App;
