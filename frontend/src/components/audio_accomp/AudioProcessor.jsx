import { useState, useRef } from "react";
import axios from "axios";        
import AudioVisualizer from "./AudioVisualizer";
import spinner from "../../assets/images/spinner.svg";
import SliderDigital from "../general_components/SliderDigital";
import "./Audio.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function AudioProcessor({ currentCard }) {
  const enablePlaying = currentCard === "audio";

  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);

  const [uploading, setUploading] = useState(false);

  const [tuning, setTuning] = useState(440);
  const [original_tuning, setOGTuning] = useState(null);
  const [processing, setProcessing] = useState(false);

  const [processedAudioBlob, setProcessedAudioBlob] = useState(null);


  const [bpm, setBpm] = useState(null);
  const [bpmLoading, setBpmLoading] = useState(false);
  const [bpmError, setBpmError] = useState(null);
  const [targetBpm, setTargetBpm] = useState(null);

  const [tonality, setTonality] = useState(null);
  const [tonalityLoading, setTonalityLoading] = useState(false);
  const [tonalityError, setTonalityError] = useState(null);


  const log = (msg) => {
    console.log(msg);
  };

  // ----------------------------------
  // UPLOAD FILE
  // ----------------------------------
  const uploadFile = async (selectedFile = file) => {
    if (!selectedFile) {
      log("No file provided for upload");
      return;
    }
    log("Upload started...");
    log(`Selected file: ${selectedFile.name}`);

    const form = new FormData();      
    form.append("file", selectedFile);

    try {
      setUploading(true);
      const res = await axios.post(`${API}/upload`, form);

      log("Backend responded:");
      log(JSON.stringify(res.data, null, 2));

      const { message, tuning, tuning_detection_error } = res.data;

      setTuning(tuning);
      setOGTuning(tuning);
      log(`Detected tuning: ${tuning}`);          
      const t = await getTuning();                  
      if (Number.isFinite(t)) await getAudio(t);
      await Promise.all([detectBpm(), detectTonality()]);

    } catch (err) {
      log("Upload failed");
      log(err.toString());
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelected = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    uploadFile(selected);
    // allow re-selecting the same file later
    e.target.value = "";
  };

  // ----------------------------------
  // REQUEST TUNING
  // ----------------------------------

  const getTuning = async () => {
    log("Requesting tuning...");

    try {
      const res = await axios.get(`${API}/get-tuning`);
      const t = Number(res.data.tuning);
      setTuning(t);
      log(`Received tuning: ${t}`);
      return t;
    } catch (err) {
      log("Get tuning failed");
      log(err.toString());
      alert("Get tuning failed");
      return null;
    }
};

  // ----------------------------------
  // DETECT BPM
  // ----------------------------------
  const detectBpm = async () => {
    log("Detecting BPM...");
    setBpmLoading(true);
    setBpm(null);
    setBpmError(null);
    try {
      const res = await axios.get(`${API}/getBppmDetector`);
      const detected = Number(res.data.bpm);
      setBpm(detected);
      // default target to detected bpm for 1x playback
      const fixedNumber = detected.toFixed(2);     
      setTargetBpm(((prev) => (prev === null ? fixedNumber : prev)));
      log(`BPM detected: ${detected}`);
      return detected;
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      setBpmError(msg);
      log(`BPM detect failed: ${msg}`);
      return null;
    } finally {
      setBpmLoading(false);
    }
  };

  // ----------------------------------
  // DETECT TONALITY
  // ----------------------------------
  const detectTonality = async () => {
    log("Detecting tonality...");
    setTonalityLoading(true);
    setTonality(null);
    setTonalityError(null);
    try {
      const res = await axios.get(`${API}/getTonality`);
      setTonality(res.data);
      log(`Tonality detected: ${res.data.key} (confidence: ${res.data.confidence})`);
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      setTonalityError(msg);
      log(`Tonality detect failed: ${msg}`);
      return null;
    } finally {
      setTonalityLoading(false);
    }
  };

  
  // ----------------------------------
  // REQUEST PROCESSED AUDIO
  // ----------------------------------
  const getAudio = async (targetTuning = tuning) => {
    const t = Number(targetTuning);

  // GUARDIA: evita 422 da NaN/undefined/null   
  if (!Number.isFinite(t)) {
    log(`Invalid target_tuning: ${targetTuning} (Number -> ${t})`);
    return;
  }

  log("Requesting processed audio...");

  try {
    setProcessing(true);

    const res = await axios.post(
      `${API}/get-audio`,
      { target_tuning: t },
      { responseType: "blob" }
    );

    log("Received audio Blob");

  setProcessedAudioBlob(res.data);

  } catch (err) {
    log("Failed to fetch processed audio");
    if (err.response) {
      log(`Status: ${err.response.status}`);
      log(`Data: ${JSON.stringify(err.response.data)}`);
    } else {
      log(err.message);
    }
  } finally {
    setProcessing(false);
  }
};


  // ----------------------------------
  // UI
  // ----------------------------------
  return (
    <div>
      <figure className="audio-figure">
          <div className="outerBevel">
            <div className="flatSurface">
              <div className="innerBevel">
                <div className="inside noise pixelFont "  style={{ padding: "2rem", position: "relative" }}>
                  <div>
                    <h2>Audio Processor</h2>
                      {/* Upload section */}
                      <div className="audio-row">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*"
                            onChange={handleFileSelected}
                            style={{ display: "none" }}
                            disabled={uploading}
                          />
                          <div
                          onClick={() => {
                              if (uploading) return;
                              fileInputRef.current?.click();
                            }}
                            style={{ marginRight: "10px" , width: "200px"}}
                            disabled={uploading}
                            className="digitalbutton"
                          >
                            {uploading ? "uploading..." : "upload"}
                          </div>
                          {file && (
                            <span style={{ marginLeft: "12px" }}>
                            selected file: <strong>{file.name}</strong>
                            </span>
                          )}
                          {uploading && (
                            <span style={{ marginLeft: "14px", display: "inline-flex", alignItems: "center" }}>
                              <img src={spinner} alt="React loader" className="spinner" />  
                            </span>
                          )}
                      </div>
                      {/* Controls */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center", 
                          gap: "20px",         
                          marginTop: "20px",
                          marginBottom: "20px"
                        }}
                      >
                        <label style={{width: "100px", flex: "0 0 auto" }}>A4 (Hz): </label>
                          <input
                            style={{ width: "140px", height:"50px" }}
                            className='pixel-select'
                            type="number"
                            step="1"
                            value={tuning}
                            onChange={(e) => setTuning(Number(e.target.value))}
                          />

                          <div
                            style={{ marginLeft: "20px", width: "200px"}}
                            onClick={() => getAudio(tuning)}
                            disabled={processing}
                            className="digitalbutton"
                            >
                          {processing ? "processing..." : "process audio"}
                          </div>
                      </div>

                     {original_tuning !== null && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 220px", // left text grows, right fixed for slider 
                            columnGap: "60px",
                            alignItems: "start",
                            marginTop: "20px",
                          }}
                        >
                          {/* LEFT: analysis text */}
                          <div>
                            <div style={{ marginTop: "0px" }}>
                              <strong>original tuning:</strong> {original_tuning} Hz
                            </div>

                            <div
                              style={{
                                marginTop: "12px",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "30px",
                                alignItems: "center",
                              }}
                            >
                              <span>
                                <strong>original BPM:</strong>{" "}
                                {bpmLoading ? "detecting..." : bpm !== null ? bpm.toFixed(2) : "—"}
                              </span>
                              {bpmError && <span style={{ color: "red" }}>{bpmError}</span>}

                              <span>
                                <strong>tonality:</strong>{" "}
                                {tonalityLoading
                                  ? "detecting..."
                                  : tonality
                                  ? `${tonality.key} (confidence: ${tonality.confidence?.toFixed?.(2) ?? "–"})`
                                  : "—"}
                              </span>
                              {tonalityError && <span style={{ color: "red" }}>{tonalityError}</span>}
                            </div>
                          </div>
                        
                        </div>
                        
                      )}
                       {original_tuning !== null && (
                        <div
                          style={{
                            position: "absolute",
                            top: "140px", 
                            right: "80px",     
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "16px",
                          }}
                        >
                          <SliderDigital
                            value={targetBpm}
                            min={20}
                            max={300}
                            step={1}
                            onChange={(value) => setTargetBpm(value)}
                          />

                          <div style={{ width: "160px", textAlign: "center" }}>
                            BPM: {targetBpm}
                          </div>
                        </div>
                        
                      )}


                      {/* ---------------- PROCESSED AUDIO PLAYER ---------------- */}
                      {processedAudioBlob && (
                        <div style={{ marginTop: "30px", padding: "15px" }}>
                          <div style={{ marginTop: "20px" }}>
                            <h3>Processed Audio Waveform</h3>
                            <AudioVisualizer
                              enablePlaying={enablePlaying}
                              audioFile={processedAudioBlob}
                              playbackSpeed={bpm && targetBpm ? targetBpm / bpm : 1}
                            />
                          </div>
                        </div>
                      )}



                  </div>
              </div>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}
