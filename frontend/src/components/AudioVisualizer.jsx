import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

export default function AudioVisualizer({ audioFile }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);

  useEffect(() => {
    if (!audioFile) return;

    // Init WaveSurfer
    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#00f",
      progressColor: "#0f0",
      height: 100,
      responsive: true,
    });

    // Load the file
    wavesurferRef.current.load(URL.createObjectURL(audioFile));

    return () => {
      wavesurferRef.current.destroy();
    };
  }, [audioFile]);

  return <div ref={containerRef} />;
}
