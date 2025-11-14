import { useState, useEffect } from "react";
import * as Tone from "tone";
import "./Player.css";

export default function ChordPlayer({ chords = [], sequence = [], bpm = 120 }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const playSequence = async () => {
    if (sequence.length === 0 || chords.length === 0) return;

    await Tone.start(); // richiesto per i browser moderni

    const now = Tone.now();
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();

    let stepDuration = 60 / bpm; // durata di 1 step in secondi

    sequence.forEach((step, stepIndex) => {
      step.forEach(obj => {
        if (obj.start) {
          const chord = chords[obj.chordIndex];
          const freqs = chord.notes.map(n => n.freq);
          synth.triggerAttackRelease(freqs, stepDuration, now + stepIndex * stepDuration);
        }
      });
    });
  };

  const handlePlay = () => {
    setIsPlaying(true);
    playSequence().then(() => setIsPlaying(false));
  };

  return (
    <div className="player-container">
      <h2>Chord Player</h2>
      <button onClick={handlePlay} disabled={isPlaying}>
        {isPlaying ? "Playing..." : "Play Sequence"}
      </button>
    </div>
  );
}
