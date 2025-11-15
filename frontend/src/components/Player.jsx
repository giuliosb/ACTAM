import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import "./Sequencer.css"; // Assumo tu abbia già il CSS del sequencer

export default function SequencerPlayer({ sequence, chords, bpm = 120 }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [snapshot, setSnapshot] = useState(null);

  const synthRef = useRef(null);
  const stepIndexRef = useRef(0);
  const loopRef = useRef(null);

  useEffect(() => {
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
    }).toDestination();

    Tone.Transport.bpm.value = bpm;
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = "1m"; // 16 step = 1 misura
  }, [bpm]);

  const startPlayback = async () => {
    // Catturo snapshot profondo al momento del Play
    const snap = JSON.parse(JSON.stringify(sequence));
    setSnapshot(snap);

    stepIndexRef.current = 0;
    setCurrentStep(0);

    await Tone.start();

    loopRef.current = new Tone.Loop((time) => {
      const stepIndex = stepIndexRef.current;
      setCurrentStep(stepIndex);
      playStep(stepIndex, time, snap);
      stepIndexRef.current = (stepIndex + 1) % snap.length;
    }, "16n");

    loopRef.current.start(0);
    Tone.Transport.start();
    setIsPlaying(true);
  };

  const stopPlayback = () => {
    if (loopRef.current) loopRef.current.cancel();
    Tone.Transport.stop();
    setIsPlaying(false);
    setCurrentStep(-1);
    stepIndexRef.current = 0;
    setSnapshot(null);
  };

  const playStep = (stepIndex, time, snap) => {
    const step = snap[stepIndex];
    if (!step) return;

    step.forEach((obj) => {
      if (!obj.start) return;
      const chord = chords[obj.chordIndex];
      if (!chord) return;

      const freqs = chord.notes.map((n) => n.freq);
      const duration = (60 / bpm / 4) * obj.sustain; // sustain in secondi
      synthRef.current.triggerAttackRelease(freqs, duration, time);
    });
  };

  // Funzione per determinare lo stile della cella
  const getCellStyle = (stepIndex, chordIndex) => {
    if (!snapshot) return {};
    const step = snapshot[stepIndex];
    if (!step) return {};

    const obj = step.find(o => o.chordIndex === chordIndex);
    if (!obj) return {};

    // Se è start o sustain
    if (obj.start) return { backgroundColor: "#4caf50" };
    return { backgroundColor: "#a5d6a7" };
  };

  return (
    <div className="sequencer-container">
      <h2>Sequencer Player (Tone.js)</h2>
      <div className="flex gap-2 mb-4">
        {!isPlaying ? (
          <button onClick={startPlayback} className="border px-4 py-2">
            Play
          </button>
        ) : (
          <button onClick={stopPlayback} className="border px-4 py-2">
            Stop
          </button>
        )}
      </div>

      {/* Sequencer visuale */}
      {chords.map((chord, chordIndex) => (
        <div key={chordIndex} className="grid-row">
          <div className="grid-cell chord-name">{chord.root} {chord.triad} {chord.extension}</div>
          {Array.from({ length: 16 }).map((_, stepIndex) => {
            const style = getCellStyle(stepIndex, chordIndex);
            // Evidenzia anche lo step corrente con bordo
            if (stepIndex === currentStep) style.border = "2px solid yellow";
            return <div key={stepIndex} className="grid-cell step-cell" style={style}></div>;
          })}
        </div>
      ))}
    </div>
  );
}
