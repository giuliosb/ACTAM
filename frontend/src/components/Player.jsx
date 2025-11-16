import { useRef, useState } from "react";

let Tone = null;

export default function Player({ sequence, chords, onStep }) {
  const STEPS = 16;

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);

  const kick = useRef(null);
  const snare = useRef(null);
  const hihat = useRef(null);
  const poly = useRef(null);

  const transportEvent = useRef(null);
  let stepCounter = useRef(0);

  const initSynths = () => {
  if (kick.current) return;

  kick.current = new Tone.MembraneSynth().toDestination();
  snare.current = new Tone.NoiseSynth().toDestination();
  hihat.current = new Tone.MetalSynth().toDestination();

  // --- CHORD SYNTH MIGLIORATO ---
  const chorus = new Tone.Chorus(4, 2.5, 0.4).start();
  const filter = new Tone.Filter(1500, "lowpass");
  const reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01 });
  const limiter = new Tone.Limiter(-1);

  poly.current = new Tone.PolySynth(Tone.FMSynth, {
    maxPolyphony: 24,
    volume: -8,
    detune: 5,
    envelope: { attack: 0.03, decay: 0.3, sustain: 0.5, release: 1.0 }
  })
    .chain(filter, chorus, reverb, limiter)
    .toDestination();
};


  const playStep = (step, time) => {
    const events = sequence[step] || [];

    const playStep = (step, time) => {
        const events = sequence[step] || [];

        // ----- DRUM -----
        events.forEach(ev => {
            if (ev.type === "drum") {
            if (ev.drum === "kick") kick.current?.triggerAttackRelease("C1", "8n", time);
            if (ev.drum === "snare") snare.current?.triggerAttackRelease("8n", time);
            if (ev.drum === "hihat") hihat.current?.triggerAttackRelease("16n", time);
            }
        });

  // ----- CHORD -----
  for (const ev of events) {

    if (ev.type === "chord" && ev.start) {

      // 1) prendi accordo
      const chord = chords[ev.chordIndex];
      if (!chord) break;

      // 2) frequenze
      const freqs = chord.notes.map(n => n.freq);

      // 3) durata musicale minima
      const stepDuration = 60 / bpm / 4;
      const sustainSteps = Math.max(1, ev.sustain);
      const sustainSeconds = Math.max(0.03, sustainSteps * stepDuration);

      // 4) suona l'accordo
      poly.current?.triggerAttackRelease(freqs, sustainSeconds, time);

      break; // IMPORTANTISSIMO → evita doppio attacco nello stesso step
    }
  }
};

    };


  const start = async () => {
    Tone = await import("tone");
    await Tone.start();

    initSynths();

    Tone.Transport.bpm.value = bpm;

    stepCounter.current = 0;

    transportEvent.current = Tone.Transport.scheduleRepeat((time) => {
      const step = stepCounter.current;

      onStep(step);
      playStep(step, time);

      // INCREMENTO SICURO
      stepCounter.current = (stepCounter.current + 1) % STEPS;

    }, "16n");

    Tone.Transport.start();
    setIsPlaying(true);
  };

  const stop = () => {
    if (!Tone) return;

    Tone.Transport.stop();
    Tone.Transport.cancel();
    onStep(-1);

    stepCounter.current = 0;
    setIsPlaying(false);
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      <button onClick={isPlaying ? stop : start}>
        {isPlaying ? "Stop" : "Play"}
      </button>

      <label style={{ marginLeft: "20px" }}>BPM:</label>

      <input
        type="number"
        min="40"
        max="240"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        disabled={isPlaying}
        style={{ width: "60px", margin: "0 10px" }}
      />

      <input
        type="range"
        min="40"
        max="240"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        disabled={isPlaying}
        style={{ width: "200px" }}
      />
    </div>
  );
}
