import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import "./Sequencer.css";

export default function SequencerPlayer({ sequence, chords, bpm = 120 }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [snapshot, setSnapshot] = useState(null);

  const synthRef = useRef(null);
  const stepIndexRef = useRef(0);
  const eventIdRef = useRef(null);

  useEffect(() => {
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
    }).toDestination();

    const transport = Tone.getTransport();
    transport.bpm.value = bpm;
  }, [bpm]);

  const startPlayback = async () => {
    if (!sequence || sequence.length === 0) return;

    const snap = JSON.parse(JSON.stringify(sequence));
    setSnapshot(snap);
    stepIndexRef.current = 0;
    setCurrentStep(0);

    await Tone.start();

    const transport = Tone.getTransport();

    if (eventIdRef.current !== null) {
      transport.clear(eventIdRef.current);
      eventIdRef.current = null;
    }

    eventIdRef.current = transport.scheduleRepeat((time) => {
      const stepIndex = stepIndexRef.current;
      setCurrentStep(stepIndex);
      playStep(stepIndex, time, snap);
      stepIndexRef.current = (stepIndex + 1) % snap.length;
    }, "16n", 0);

    transport.start();
    setIsPlaying(true);
  };

  const stopPlayback = () => {
    const transport = Tone.getTransport();
    if (eventIdRef.current !== null) {
      transport.clear(eventIdRef.current);
      eventIdRef.current = null;
    }
    transport.stop();
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
      const duration = (60 / bpm / 4) * obj.sustain;
      synthRef.current.triggerAttackRelease(freqs, duration, time);
    });
  };

  const getCellStyle = (stepIndex, chordIndex) => {
    if (!snapshot || chords.length === 0) return {};
    const step = snapshot[stepIndex];
    if (!step) return {};

    const obj = step.find((o) => o.chordIndex === chordIndex);
    if (!obj) return {};

    if (obj.start) return { backgroundColor: "#4caf50" };
    return { backgroundColor: "#a5d6a7" };
  };

  const STEPS = sequence.length || 16;

  return (
    <div className="sequencer-container">
      <h2>Sequencer Player</h2>
      <div className="flex gap-2 mb-4">
        {!isPlaying ? (
          <button onClick={startPlayback} className="border px-4 py-2">Play</button>
        ) : (
          <button onClick={stopPlayback} className="border px-4 py-2">Stop</button>
        )}
      </div>

      <div className="grid player-grid-horizontal">
        {/* Header Step */}
        <div className="grid-row header">
          <div className="grid-cell header-cell step-name-cell">Step</div>
          {chords.length > 0 &&
            chords.map((chord, idx) => (
              <div key={idx} className="grid-cell header-cell chord-cell">
                {chord.root} {chord.triad} {chord.extension}
              </div>
            ))}
        </div>

        {/* Steps come righe */}
        {Array.from({ length: STEPS }).map((_, stepIndex) => (
          <div key={stepIndex} className="grid-row">
            <div className="grid-cell step-name-cell">{stepIndex + 1}</div>
            {chords.length > 0 &&
              chords.map((_, chordIndex) => {
                const style = getCellStyle(stepIndex, chordIndex);
                if (stepIndex === currentStep) style.border = "2px solid yellow";
                return (
                  <div
                    key={chordIndex}
                    className="grid-cell step-cell"
                    style={style}
                  ></div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
