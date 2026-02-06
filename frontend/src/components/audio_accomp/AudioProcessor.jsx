import { useState, useRef } from "react";
import axios from "axios";
import AudioVisualizer from "./AudioVisualizer";
import reactLogo from "../../assets/react.svg";


const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";


export default function AudioProcessor() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploadResponse, setUploadResponse] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [tuning, setTuning] = useState(440);
  const [original_tuning, setOGTuning] = useState(null);
  const [processing, setProcessing] = useState(false);

  const [processedAudioBlob, setProcessedAudioBlob] = useState(null);
  const [processedAudioURL, setProcessedAudioURL] = useState(null);

  const [uploadedAudioBlob, setUploadedAudioBlob] = useState(null);

  const [bpm, setBpm] = useState(null);
  const [bpmLoading, setBpmLoading] = useState(false);
  const [bpmError, setBpmError] = useState(null);
  const [targetBpm, setTargetBpm] = useState(null);

  const [tonality, setTonality] = useState(null);
  const [tonalityLoading, setTonalityLoading] = useState(false);
  const [tonalityError, setTonalityError] = useState(null);

  const [logs, setLogs] = useState([]);

  const log = (msg) => {
    console.log(msg);
    setLogs((prev) => [...prev, msg]);
  };

  // ----------------------------------
  // UPLOAD FILE
  // ----------------------------------
  const uploadFile = async (selectedFile = file) => {
    if (!selectedFile) {
      log("❌ No file provided for upload");
      return;
    }
    log("📤 Upload started...");
    log(`Selected file: ${selectedFile.name}`);

    const form = new FormData();
    form.append("file", selectedFile);

    setUploadedAudioBlob(selectedFile);

    try {
      setUploading(true);
      const res = await axios.post(`${API}/upload`, form);

      log("📡 Backend responded:");
      log(JSON.stringify(res.data, null, 2));

      const { message, tuning, tuning_detection_error } = res.data;

      setUploadResponse({
        message,
        tuning,
        error: tuning_detection_error || null,
      });


      setTuning(tuning);
      setOGTuning(tuning);
      log(`🎵 Detected tuning: ${tuning}`);
      const t = await getTuning();
      if (Number.isFinite(t)) await getAudio(t);
      await Promise.all([detectBpm(), detectTonality()]);

    } catch (err) {
      log("❌ Upload failed");
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
  log("🎧 Requesting tuning...");

  try {
    const res = await axios.get(`${API}/get-tuning`);
    const t = Number(res.data.tuning);
    setTuning(t);
    log(`🎵 Got tuning: ${t}`);
    return t;
  } catch (err) {
    log("❌ Get tuning failed");
    log(err.toString());
    alert("Get tuning failed");
    return null;
  }
};

  // ----------------------------------
  // DETECT BPM
  // ----------------------------------
  const detectBpm = async () => {
    log("🥁 Detecting BPM...");
    setBpmLoading(true);
    setBpm(null);
    setBpmError(null);
    try {
      const res = await axios.get(`${API}/getBppmDetector`);
      const detected = Number(res.data.bpm);
      setBpm(detected);
      // default target to detected bpm for 1x playback
      setTargetBpm((prev) => (prev === null ? detected : prev));
      log(`🥁 BPM detected: ${detected}`);
      return detected;
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      setBpmError(msg);
      log(`❌ BPM detect failed: ${msg}`);
      return null;
    } finally {
      setBpmLoading(false);
    }
  };

  // ----------------------------------
  // DETECT TONALITY
  // ----------------------------------
  const detectTonality = async () => {
    log("🎼 Detecting tonality...");
    setTonalityLoading(true);
    setTonality(null);
    setTonalityError(null);
    try {
      const res = await axios.get(`${API}/getTonality`);
      setTonality(res.data);
      log(`🎼 Tonality detected: ${res.data.key} (conf: ${res.data.confidence})`);
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      setTonalityError(msg);
      log(`❌ Tonality detect failed: ${msg}`);
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
    log(`❌ Invalid target_tuning: ${targetTuning} (Number -> ${t})`);
    return;
  }

  log("🎧 Requesting processed audio...");

  try {
    setProcessing(true);

    const res = await axios.post(
      `${API}/get-audio`,
      { target_tuning: t },
      { responseType: "blob" }
    );

    log("⬅️ Received audio Blob");

    const blob = res.data;
    const url = URL.createObjectURL(blob);

    setProcessedAudioBlob(blob);
    setProcessedAudioURL(url);
  } catch (err) {
    log("❌ Failed to fetch processed audio");
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
    <div style={{ marginTop: "40px", padding: "20px", border: "1px solid #ccc" }}>
      <h2>Audio Processor</h2>

      {original_tuning !== null && (
        <>
          <div style={{ marginTop: "20px" }}>
            <strong>Original tuning:</strong> {original_tuning} Hz
          </div>
          <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center" }}>
            <span>
              <strong>BPM:</strong>{" "}
              {bpmLoading ? "Detecting..." : bpm !== null ? bpm.toFixed(2) : "—"}
            </span>
            {bpmError && <span style={{ color: "red" }}>{bpmError}</span>}
            <span>
              <strong>Tonality:</strong>{" "}
              {tonalityLoading
                ? "Detecting..."
                : tonality
                ? `${tonality.key} (conf: ${tonality.confidence?.toFixed?.(2) ?? "–"})`
                : "—"}
            </span>
            {tonalityError && <span style={{ color: "red" }}>{tonalityError}</span>}
            <span>
              <strong>Target BPM:</strong>{" "}
              <input
                type="number"
                value={targetBpm ?? ""}
                onChange={(e) => setTargetBpm(Number(e.target.value))}
                style={{ width: "90px" }}
                min="20"
                max="300"
              />
            </span>
          </div>
        </>
      )}

      {/* Upload section */}
      <div style={{ marginBottom: "20px" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelected}
          style={{ display: "none" }}
          disabled={uploading}
        />
        <button
          onClick={() => {
            if (uploading) return;
            fileInputRef.current?.click();
          }}
          style={{ marginLeft: "10px" }}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
        {file && (
          <span style={{ marginLeft: "12px" }}>
            File selezionato: <strong>{file.name}</strong>
          </span>
        )}
        {uploading && (
          <span style={{ marginLeft: "14px", display: "inline-flex", alignItems: "center" }}>
            <img
              src={reactLogo}
              alt="React loader"
              style={{ width: "36px", height: "36px", animation: "spin 1s linear infinite" }}
            />
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </span>
        )}
      </div>

      {uploadResponse && (
        <pre>{JSON.stringify(uploadResponse, null, 2)}</pre>
      )}

      <hr />

      {/* Controls */}
      <div style={{ marginTop: "20px" }}>
       
        <label style={{ marginLeft: "20px" }}>Tuning (Hz): </label>
        <input
          type="number"
          step="1"
          value={tuning}
          onChange={(e) => setTuning(Number(e.target.value))}
        />

        <button
          style={{ marginLeft: "20px" }}
          onClick={() => getAudio(tuning)}
        disabled={processing}
          >
        {processing ? "Processing..." : "Process Audio"}
        </button>
      </div>

      {/* ---------------- PROCESSED AUDIO PLAYER ---------------- */}
      {processedAudioURL && (
        <div style={{ marginTop: "30px", padding: "15px", border: "1px solid #aaa" }}>
          <h3>Processed Audio</h3>

          <audio controls src={processedAudioURL} />

          {processedAudioBlob && (
            <div style={{ marginTop: "20px" }}>
              <h3>Processed Audio Waveform</h3>
              <AudioVisualizer
                audioFile={processedAudioBlob}
                playbackSpeed={bpm && targetBpm ? targetBpm / bpm : 1}
              />
            </div>
          )}

          {/* Download button */}
          {/* <button
            style={{ marginTop: "10px" }}
            onClick={() => {
              const a = document.createElement("a");
              a.href = processedAudioURL;
              a.download = "processed_audio.flac";
              a.click();
            }}
          >
            Download Processed Audio
          </button> */}
        </div>
      )}

      {/* ---------------- LOG PANEL ---------------- */}
      <div
        style={{
          background: "#111",
          color: "#0f0",
          padding: "15px",
          height: "200px",
          overflowY: "auto",
          fontFamily: "monospace",
          borderRadius: "8px",
          marginTop: "20px",
        }}
      >
        <strong>🔍 Debug Log Panel</strong>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: "10px" }}>
          {logs.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </pre>
      </div>
    </div>
  );
}
