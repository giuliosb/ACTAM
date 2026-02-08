import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'

export default function AudioVisualizer({ enablePlaying, audioFile, playbackSpeed = 1 }) {
  const containerRef = useRef(null);

  const wavesurferRef = useRef(null);
  const regionRef = useRef(null);
  const regionsPluginRef = useRef(null);

  // Helper: destroy a WaveSurfer instance and swallow AbortError (raised when aborting pending loads)
  const safeDestroy = (ws) => {
    if (!ws) return;
    try {
      const maybePromise = ws.destroy();
      if (maybePromise?.catch) {
        maybePromise.catch((err) => {
          if (err?.name !== "AbortError") {
            console.error("WaveSurfer destroy error:", err);
          }
        });
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("WaveSurfer destroy error:", err);
      }
    }
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  const [zoom, setZoom] = useState(10);
  const [isReady, setIsReady] = useState(false);

  const [loopEnabled, setLoopEnabled] = useState(true);

  const loopEnabledRef = useRef(loopEnabled);

  //Abort on card change
  useEffect(() => {
    if (!enablePlaying) {
      wavesurferRef.current?.pause();
      setIsPlaying(false);
    }
  }, [enablePlaying, setIsPlaying]);

  // Give regions a random color when they are created
  
  const regionColor = 'rgba(21, 72, 73, 0.15)';


  const hasLoadedAudio = () => {
    try {
      return !!wavesurferRef.current?.getDecodedData();
    } catch {
      return false;
    }
  };

  const applyZoom = () => {
    const ws = wavesurferRef.current;
    if (!ws || !hasLoadedAudio()) return;
    try {
      ws.zoom(zoom);
    } catch (err) {
      if (err?.message?.includes("No audio loaded")) return;
      console.error("WaveSurfer zoom error:", err);
    }
  };

  useEffect(() => {
    if (!audioFile) return;

    // cleanup previous instance
    setIsReady(false);
    if (wavesurferRef.current) {
      safeDestroy(wavesurferRef.current);
      wavesurferRef.current = null;
      regionRef.current = null;
      regionsPluginRef.current = null;
    }

    const regionsPlugin = RegionsPlugin.create({
      dragSelection: false, // do NOT create/move regions by dragging the waveform
    });
    const timelinePlugin = TimelinePlugin.create();

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 140,
      waveColor: 'rgb(21, 72, 73)',
      progressColor:'rgb(33, 111, 112)',
      cursorWidth: 2,
      audioRate: playbackSpeed,
      responsive: true,
      minPxPerSec: 10,
      //dragToSeek: true,
      plugins: [regionsPlugin, timelinePlugin],
      // Set a bar width
      barWidth: 3,
      // Optionally, specify the spacing between bars
      barGap: 1,
      // Rounded edges
      barRadius: 1,
    });

    wavesurferRef.current = ws;
    regionsPluginRef.current = regionsPlugin;

    ws.on("error", (err) => {
      if (err?.name !== "AbortError") {
        console.error("WaveSurfer error:", err);
      }
    });

    const url = URL.createObjectURL(audioFile);
    (async () => {
      try {
        await ws.load(url);
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("WaveSurfer load error:", err);
        }
      }
    })();

    ws.on("ready", () => {
      const duration = ws.getDuration();

      //apply zoom
      applyZoom();
      setIsReady(true);

      // initial selection is the whole audio
      const region = regionsPlugin.addRegion({
        start: 0,
        end: duration,
        drag: true,     
        resize: true,     // CAN drag handles
        color: regionColor,
        handleStyle: {
          left: {
            width: "3px",
            backgroundColor: "rgba(21, 72, 73, 0.9)", // start handle
          },
          right: {
            width: "3px",
            backgroundColor: "rgba(21, 72, 73, 0.9)", // end handle
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
      safeDestroy(ws);
      URL.revokeObjectURL(url);
    };
  }, [audioFile]);

  // Update playback speed live
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(playbackSpeed);
    }
  }, [playbackSpeed]);

  // Update loop state
  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
    console.log("Loop changend:", loopEnabled);
  }, [loopEnabled]);

  // Update zoom state
  useEffect(() => {
    if (!isReady) return;
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.zoom(zoom);
  }, [zoom, isReady]);

  const handlePlayPauseButton = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }
  const handlePlay = () => {
    const ws = wavesurferRef.current;
    const region = regionRef.current;
    if (!ws || !region) return;
    if(loopEnabledRef.current)  ws.play(region.start);
    else ws.play();
  };

  const handlePause = () => {
    wavesurferRef.current?.pause();
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <div ref={containerRef} style={{ width: "100%" }} />

      {/* PLAY BUTTON */}
       <button
            className="start-button-audio"
            style={{ marginTop: "10px" }}
            onClick={handlePlayPauseButton}>
            {isPlaying ? (
              <svg
                className="pixel-icon icon-pause"
                viewBox="0 0 52 64"
                role="img"
                aria-hidden="true"
              >
                <rect x="6" y="14" width="10" height="36" />
                <rect x="30" y="14" width="10" height="36" />
              </svg>
            ) : (
              <svg
                className="pixel-icon icon-play"
                viewBox="0 0 72 64"
                role="img"
                aria-hidden="true"
              >
                <path d="M12 12 H42 L62 32 L42 52 H12 Z" />
              </svg>
            )}
          </button>
      <div
        style={{
          marginTop: "10px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span>
          Start: {startTime.toFixed(2)}s • End: {endTime.toFixed(2)}s
        </span>
      </div>


      {/* Zoom SLIDER */}
       <div style={{ marginTop: "10px" }}>
        <label>
          Zoom:{" "}
          <input
            type="range"
            min="1"
            max="1000"
            value={zoom}
            onChange={(e) => setZoom(e.target.valueAsNumber)}
          />
          <span style={{ marginLeft: 8 }}>{zoom} px/sec</span>
        </label>
      </div>


       {/* LOOP CHECKBOX */}
      <div style={{ marginTop: "10px" }}>
        <input
            type="checkbox"
            style={{ height: "24px", width: "24px" }}
            checked={loopEnabled}
            onChange={(e) => setLoopEnabled(e.target.checked)}
          />
        <label style={{ marginLeft: "20px" }}>
          Loop region
        </label>
      </div>

    </div>
  );
}
