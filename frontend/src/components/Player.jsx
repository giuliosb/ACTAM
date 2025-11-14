import { useState, useEffect } from "react";
import * as Tone from "tone";
import "./Player.css";

export default function ChordPlayer({ sequence = [], chords = [], bpm = 120 }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  const startPlayback = async () => {
    if (sequence.length === 0 || chords.length === 0) return;

    await Tone.start();

    const synth = new Tone.PolySynth(Tone.Synth).toDestination();

    // Cancella eventi precedenti
    Tone.Transport.cancel();
    setCurrentStep(-1);

    const stepDuration = Tone.Time("4n").toSeconds(); // ogni step = una quartina

    sequence.forEach((step, i) => {
      if (step.length === 0) return; // nessun accordo in questo step

      Tone.Transport.schedule((time) => {
        setCurrentStep(i);

        // raccogli le note di tutti gli accordi attivi
        const notes = step.flatMap((chordIndex) => {
          const chord = chords[chordIndex];
          if (!chord) return [];
          return chord.notes.map(n => `${n.note}${n.octave}`);
        });

        if (notes.length > 0) {
          synth.triggerAttackRelease(notes, stepDuration, time);
        }
      }, `+${i * stepDuration}`);
    });

    // reset step dopo l’ultimo
    Tone.Transport.schedule(() => {
      setCurrentStep(-1);
      setIsPlaying(false);
    }, `+${sequence.length * stepDuration}`);

    Tone.Transport.start();
    setIsPlaying(true);
  };

  const stopPlayback = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    setIsPlaying(false);
    setCurrentStep(-1);
  };

  return (
    <div className="chord-player">
      <h2>Chord Player</h2>
      <div className="controls">
        {!isPlaying ? (
          <button onClick={startPlayback}>Play</button>
        ) : (
          <button onClick={stopPlayback}>Stop</button>
        )}
      </div>

      <div className="sequence-visual">
        {sequence.map((step, i) => {
          const active = currentStep === i;
          return (
            <div key={i} className={`step ${active ? "current" : ""}`}>
              {step.map(idx => chords[idx]?.root).join(",")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
