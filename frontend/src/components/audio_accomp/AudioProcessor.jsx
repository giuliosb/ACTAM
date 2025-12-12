import { useState, useEffect } from "react";
import axios from "axios";
import AudioVisualizer from "./AudioVisualizer";


const API = "http://127.0.0.1:8000";

export default function AudioProcessor() {
  const [file, setFile] = useState(null);
  const [uploadResponse, setUploadResponse] = useState(null);

  const [tuning, setTuning] = useState(440);
  const [original_tuning, setOGTuning] = useState(440);
  const [processing, setProcessing] = useState(false);

  const [processedAudioBlob, setProcessedAudioBlob] = useState(null);
  const [processedAudioURL, setProcessedAudioURL] = useState(null);

  const [uploadedAudioBlob, setUploadedAudioBlob] = useState(null);
 

  const [logs, setLogs] = useState([]);

  const log = (msg) => {
    console.log(msg);
    setLogs((prev) => [...prev, msg]);
  };

  // ----------------------------------
  // UPLOAD FILE
  // ----------------------------------
  const uploadFile = async () => {
    if (!file) return alert("Select a file first!");

    log("📤 Upload started...");
    log(`Selected file: ${file.name}`);

    const form = new FormData();
    form.append("file", file);

    setUploadedAudioBlob(file);

    try {
      const res = await axios.post(`${API}/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

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
      getAudio()
    } catch (err) {
      log("❌ Upload failed");
      log(err.toString());
      alert("Upload failed");
    }
  };

  // ----------------------------------
  // REQUEST TUNING
  // ----------------------------------

  const getTuning = async () => {
    log("🎧 Requesting tuning...");

    try {
      const res = await axios.get(`${API}/get-tuning`, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { tuning } = res.data;
      setTuning(tuning);
      getAudio();
      log(`🎵 Got tuning: ${tuning}`);
    } catch (err) {
      log("❌ Get tuning failed");
      log(err.toString());
      alert("Get tuning failed");
    }
  };
  
  // ----------------------------------
  // REQUEST PROCESSED AUDIO
  // ----------------------------------
  const getAudio = async () => {
    log("🎧 Requesting processed audio...");

    try {
      const requestBody = {
        //stretch_rate: Number(stretchRate),
        target_tuning: Number(tuning)
      };

      setProcessing(true);

      const res = await axios.post(`${API}/get-audio`, requestBody, {
        responseType: "blob",
        headers: { "Content-Type": "application/json" },
      });

      log("⬅️ Received audio Blob");

      const blob = res.data;
      const url = URL.createObjectURL(blob);

      setProcessedAudioBlob(blob);
      setProcessedAudioURL(url);

    } catch (err) {
      log("❌ Failed to fetch processed audio");
      log(err.toString());
      if (!err.toString().endsWith("404")) {
        alert("Error receiving audio");
      }
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    getTuning();
  }, []);

  // ----------------------------------
  // UI
  // ----------------------------------
  return (
    <div style={{ marginTop: "40px", padding: "20px", border: "1px solid #ccc" }}>
      <h2>Audio Processor</h2>

      <div style={{ marginTop: "20px" }}>
        <strong>Original tuning:</strong> {original_tuning} Hz
      </div>

      {/* Upload section */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button onClick={uploadFile} style={{ marginLeft: "10px" }}>
          Upload
        </button>
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
          onClick={getAudio}
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
              <AudioVisualizer audioFile={processedAudioBlob}/>
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
