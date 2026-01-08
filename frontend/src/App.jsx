import { useState } from "react";
import axios from "axios";
import "./App.css";

import Menu from "./components/Menu";
import AudioProcessor from "./components/audio_accomp/AudioProcessor";
import Accompaniment from "./components/gen_accomp_v2/Accompaniment";



function App() {
  const [currentCard, setCurrentCard] = useState("menu"); // menu | generated | audio
  const [bpm, setBpm] = useState(null);
  const [bpmLoading, setBpmLoading] = useState(false);
  const [bpmError, setBpmError] = useState(null);
  const [tonality, setTonality] = useState(null);
  const [tonalityLoading, setTonalityLoading] = useState(false);
  const [tonalityError, setTonalityError] = useState(null);

  const handleTestBpm = async () => {
    setBpm(null);
    setBpmError(null);
    setBpmLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/getBppmDetector");
      setBpm(res.data.bpm);
    } catch (err) {
      setBpmError(err?.response?.data?.detail || err.message);
    } finally {
      setBpmLoading(false);
    }
  };

  const handleGetTonality = async () => {
    setTonality(null);
    setTonalityError(null);
    setTonalityLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/getTonality");
      setTonality(res.data);
    } catch (err) {
      setTonalityError(err?.response?.data?.detail || err.message);
    } finally {
      setTonalityLoading(false);
    }
  };

  const renderCard = () => {
    switch (currentCard) {
      case "generated":
        return <Accompaniment />;
      case "audio":
        return (
          <>
            <AudioProcessor />
            <button onClick={handleTestBpm} style={{ marginLeft: "10px" }}>Detect BPM</button>
            {bpmLoading && <span style={{ marginLeft: "10px" }}>Detecting BPM...</span>}
            {bpm !== null && !bpmLoading && (
              <span style={{ marginLeft: "10px" }}> BPM: <b>{bpm.toFixed(2)}</b></span>
            )}
            {bpmError && <span style={{ color: "red", marginLeft: "10px" }}>{bpmError}</span>}

            <button onClick={handleGetTonality} style={{ marginLeft: "10px" }}>Get Tonality</button>
            {tonalityLoading && <span style={{ marginLeft: "10px" }}>Detecting tonality...</span>}
            {tonality && !tonalityLoading && (
              <span style={{ marginLeft: "10px" }}>
                Key: <b>{tonality.key}</b> (confidence: {tonality.confidence.toFixed(2)})
              </span>
            )}
            {tonalityError && <span style={{ color: "red", marginLeft: "10px" }}>{tonalityError}</span>}
          </>
        );
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
