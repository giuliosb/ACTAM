import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import "./Sequencer.css";

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
  }, [bpm]);

  const startPlayback = async () => {
    // Catturo snapshot fisso
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

  // Determina lo stile della cella (start = verde scuro, sustain = verde chiaro)
  const getCellStyle = (stepIndex, chordIndex) => {
    if (!snapshot) return {};
    const step = snapshot[stepIndex];
    if (!step) return {};

    const obj = step.find(o => o.chordIndex === chordIndex);
    if (!obj) return {};

    if (obj.start) return { backgroundColor: "#4caf50" };
    return { backgroundColor: "#a5d6a7" };
  };

  return (
    <div className="sequencer-container">
      <h2>Sequencer Player</h2>
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

      <div className="grid">
        <div className="grid-row header">
          <div className="grid-cell header-cell">Step</div>
          {chords.map((chord, idx) => (
            <div key={idx} className="grid-cell header-cell">
              {chord.root} {chord.triad} {chord.extension}
            </div>
          ))}
        </div>

        {Array.from({ length: sequence.length }).map((_, stepIndex) => (
          <div key={stepIndex} className="grid-row">
            <div className="grid-cell step-name">{stepIndex + 1}</div>
            {chords.map((_, chordIndex) => {
              const style = getCellStyle(stepIndex, chordIndex);
              // evidenzia lo step corrente con bordo giallo
              if (stepIndex === currentStep) style.border = "2px solid yellow";

              return (
                <div key={chordIndex} className="grid-cell step-cell" style={style}></div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
