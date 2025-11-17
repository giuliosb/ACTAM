import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

export default function AudioVisualizer({ audioFile }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionRef = useRef(null);
  const regionsPluginRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loopEnabled, setLoopEnabled] = useState(true);

  const loopEnabledRef = useRef(loopEnabled);

  // Give regions a random color when they are created
const random = (min, max) => Math.random() * (max - min) + min
const randomColor = () => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.15)`


  useEffect(() => {
    if (!audioFile) return;

    // cleanup previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
      regionRef.current = null;
      regionsPluginRef.current = null;
    }

    const regionsPlugin = RegionsPlugin.create({
      dragSelection: false, // do NOT create/move regions by dragging the waveform
    });

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 140,
      waveColor: 'rgb(200, 0, 200)',
      progressColor: 'rgb(100, 0, 100)',
      cursorWidth: 1,
      audioRate: playbackSpeed,
      responsive: true,
      plugins: [regionsPlugin],
      // Set a bar width
      barWidth: 2,
      // Optionally, specify the spacing between bars
      barGap: 1,
      // And the bar radius
      barRadius: 2,
    });

    wavesurferRef.current = ws;
    regionsPluginRef.current = regionsPlugin;

    const url = URL.createObjectURL(audioFile);
    ws.load(url);

    ws.on("ready", () => {
      const duration = ws.getDuration();
      // initial selection is the whole audio
      const region = regionsPlugin.addRegion({
        start: 0,
        end: duration,
        drag: true,     
        resize: true,     // CAN drag handles
        color: randomColor(),
        handleStyle: {
          left: {
            width: "3px",
            backgroundColor: "rgba(0, 255, 0, 0.9)", // start handle
          },
          right: {
            width: "3px",
            backgroundColor: "rgba(255, 0, 0, 0.9)", // end handle
          },
        },
      });

      regionRef.current = region;
      setStartTime(region.start);
      setEndTime(region.end);
    });

    

    // keep track when user moves handles
    regionsPlugin.on("region-updated", (region) => {
      if (region !== regionRef.current) return;
      setStartTime(region.start);
      setEndTime(region.end);
      console.log("Region:", region.start.toFixed(2), region.end.toFixed(2));
    });

    // stop playback at region end
   // ----------------------------------------------
    // LOOPING LOGIC
    // ----------------------------------------------
    ws.on("audioprocess", (time) => {
      const region = regionRef.current;
      if (!region) return;
      if (time >= region.end) {
       if (loopEnabledRef.current) {
          ws.play(region.start);  // restart the loop
        } else {
          ws.pause();                 // stop normally
          setIsPlaying(false);
        }
      }

    });

    

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));

    return () => {
      URL.revokeObjectURL(url);
     try {
    ws.destroy();
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("WaveSurfer destroy error:", err);
      }
    }
    };
  }, [audioFile]);

  // Update playback speed live
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(playbackSpeed);
    }
  }, [playbackSpeed]);

  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
    console.log("Loop changend:", loopEnabled);
  }, [loopEnabled]);

  const handlePlay = () => {
    const ws = wavesurferRef.current;
    const region = regionRef.current;
    if (!ws || !region) return;
    ws.play(region.start);
  };

  const handlePause = () => {
    wavesurferRef.current?.pause();
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <div ref={containerRef} style={{ width: "100%" }} />

      <div
        style={{
          marginTop: "10px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        {!isPlaying ? (
          <button onClick={handlePlay}>Play</button>
        ) : (
          <button onClick={handlePause}>Pause</button>
        )}
        <span>
          Start: {startTime.toFixed(2)}s • End: {endTime.toFixed(2)}s
        </span>
      </div>
      {/* ---------------- SPEED CONTROL ---------------- */}
      <div style={{ marginTop: "10px" }}>
        <label>Playback speed: </label>
        <input
          type="number"
          step="0.05"
          min="0.2"
          max="3"
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          style={{ width: "80px", marginLeft: "10px" }}
        />
      </div>
       {/* LOOP CHECKBOX */}
      <div style={{ marginTop: "10px" }}>
        <label>
          <input
            type="checkbox"
            checked={loopEnabled}
            onChange={(e) => setLoopEnabled(e.target.checked)}
          />
          Loop region
        </label>
      </div>
    </div>
  );
}
