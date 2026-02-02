import { useState } from "react";
import "./App.css";

import NavBar from "./components/NavBar";
import AudioProcessor from "./components/audio_accomp/AudioProcessor";
import Accompaniment from "./components/gen_accomp_v2/Accompaniment";

function App() {
  const [currentCard, setCurrentCard] = useState("generated"); // generated | audio

  const renderCard = () => {
    switch (currentCard) {
      case "generated":
        return <Accompaniment />;
      case "audio":
        return <AudioProcessor />;
      default:
        return <Accompaniment />;
    }
  };

  return (
    <div className="App" >
      <NavBar currentCard={currentCard} onSelect={setCurrentCard} />
      {/* Card container */}
      <div style={{ minHeight: "600px" }}>
        {renderCard()}
      </div>
    </div>
  );
}

export default App;
