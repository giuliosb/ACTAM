import { useRef, useState, useEffect } from "react";

// Tone.js is imported dynamically so the app loads faster
let Tone = null;

export default function Player({ sequence, chords, tracks, onStep }) {
  const STEPS = 16;

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(0);

  const kick = useRef(null);
  const snare = useRef(null);
  const hihat = useRef(null);

  const transportEvent = useRef(null);
  const stepCounter = useRef(0);

  const chordChains = useRef([]);

  // --------------------------
  // DRUM INIT
  // --------------------------
  const initDrums = () => {
    if (kick.current) return;

    kick.current = new Tone.MembraneSynth().toDestination();
    snare.current = new Tone.NoiseSynth().toDestination();
    hihat.current = new Tone.MetalSynth().toDestination();
  };

  // Master volume update
  useEffect(() => {
    if (Tone && Tone.Destination) {
      Tone.Destination.volume.value = masterVolume;
    }
  }, [masterVolume]);

  // --------------------------
  // SYNTH FACTORY (instrument selection)
  // --------------------------
  const createSynth = (instrument) => {
    switch (instrument) {
      case "sinepad":
        return new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sine" },
          envelope: { attack: 1, decay: 0.5, sustain: 0.8, release: 2.5 },
        });

      case "saw":
        return new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.5 },
        });

      case "organ":
        return new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 1.5,
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.9, release: 1.2 },
        });

      case "piano":
        return new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3,
          modulationIndex: 10,
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.8 },
        });

      default: // FM
        return new Tone.PolySynth(Tone.FMSynth, {
          envelope: { attack: 0.03, decay: 0.3, sustain: 0.5, release: 1.0 },
        });
    }
  };

  // --------------------------
  // CREATE / SYNC CHORD SYNTH CHAINS
  // (now supports instrument changes)
  // --------------------------
  useEffect(() => {
    if (!Tone || !isPlaying) return;

    for (let i = 0; i < chords.length; i++) {
      const track = tracks.chords?.[i] ?? {};
      const instrument = track.instrument || "fm";

      // Need to create or recreate the chain
      const mustRecreate =
        !chordChains.current[i] ||
        chordChains.current[i].instrument !== instrument;

      if (mustRecreate) {
        // Dispose old chain if exists
        if (chordChains.current[i]) {
          const old = chordChains.current[i];
          old.synth.dispose();
          old.filter.dispose();
          old.chorus.dispose();
          old.reverb.dispose();
          old.limiter.dispose();
        }

        // Create new chain
        const filter = new Tone.Filter(1500, "lowpass");
        const chorus = new Tone.Chorus(4, 2.5).start();
        const reverb = new Tone.Reverb({ decay: 3, preDelay: 0.01 });
        const limiter = new Tone.Limiter(-1);

        const synth = createSynth(instrument);
        synth.chain(filter, chorus, reverb, limiter, Tone.Destination);

        chordChains.current[i] = {
          synth,
          filter,
          chorus,
          reverb,
          limiter,
          instrument,
        };
      }
    }

    // Remove abandoned chains
    if (chordChains.current.length > chords.length) {
      for (let i = chords.length; i < chordChains.current.length; i++) {
        const old = chordChains.current[i];
        if (!old) continue;
        old.synth.dispose();
        old.filter.dispose();
        old.chorus.dispose();
        old.reverb.dispose();
        old.limiter.dispose();
      }
      chordChains.current.length = chords.length;
    }
  }, [chords.length, tracks.chords, isPlaying]);

  // --------------------------
  // CLEANUP
  // --------------------------
  useEffect(() => {
    return () => {
      chordChains.current.forEach((c) => {
        if (!c) return;
        c.synth.dispose();
        c.filter.dispose();
        c.chorus.dispose();
        c.reverb.dispose();
        c.limiter.dispose();
      });
      chordChains.current = [];
    };
  }, []);

  // --------------------------
  // PLAY CHORD
  // --------------------------
  const playChord = (index, freqs, sustain, time) => {
    const chain = chordChains.current[index];
    if (!chain) return;

    const t = tracks.chords?.[index] ?? {};

    chain.filter.frequency.value = t.cutoff ?? 1500;
    chain.chorus.wet.value = t.chorusMix ?? 0.5;
    chain.reverb.wet.value = t.reverbMix ?? 0.3;
    chain.synth.volume.value = t.volume ?? -8;
    chain.synth.set({ detune: t.detune ?? 0 });

    chain.synth.triggerAttackRelease(freqs, sustain, time);
  };

  // --------------------------
  // PLAY STEP
  // --------------------------
  const playStep = (step, time, offsets = {}) => {
    const { kickOffset = 0, snareOffset = 0, hihatOffset = 0 } = offsets;
    const events = sequence[step] || [];

    const drumTracks = tracks?.drums || {};
    if (kick.current) kick.current.volume.value = drumTracks.kick?.volume ?? 0;
    if (snare.current) snare.current.volume.value = drumTracks.snare?.volume ?? 0;
    if (hihat.current) hihat.current.volume.value = drumTracks.hihat?.volume ?? 0;

    // Drums
    for (const ev of events) {
      if (ev.type === "drum") {
        if (ev.drum === "kick")
          kick.current?.triggerAttackRelease("C1", "8n", time + kickOffset);

        if (ev.drum === "snare")
          snare.current?.triggerAttackRelease("8n", time + snareOffset);

        if (ev.drum === "hihat")
          hihat.current?.triggerAttackRelease("16n", time + hihatOffset);
      }
    }

    // Chord start event
    for (const ev of events) {
      if (ev.type === "chord" && ev.start) {
        const chord = chords[ev.chordIndex];
        if (!chord) break;

        const freqs = chord.notes.map((n) => n.freq);
        const stepDuration = 60 / bpm / 4;
        const sustainSeconds = Math.max(0.03, ev.sustain * stepDuration);

        playChord(ev.chordIndex, freqs, sustainSeconds, time);
        break;
      }
    }
  };

  // --------------------------
  // START TRANSPORT
  // --------------------------
  const start = async () => {
    if (!Tone) {
      Tone = await import("tone");
      await Tone.start();
    }

    initDrums();
    Tone.Transport.bpm.value = bpm;
    Tone.Destination.volume.value = masterVolume;

    stepCounter.current = 0;

    if (transportEvent.current) {
      Tone.Transport.clear(transportEvent.current);
    }

    transportEvent.current = Tone.Transport.scheduleRepeat((time) => {
      const step = stepCounter.current;
      const sixteenth = 60 / bpm / 4;

      const kickSwing = tracks.drums?.kick?.swing ?? 0;
      const snareSwing = tracks.drums?.snare?.swing ?? 0;
      const hihatSwing = tracks.drums?.hihat?.swing ?? 0;

      const kickOffset = step % 2 === 1 ? sixteenth * kickSwing * 0.5 : 0;
      const snareOffset = step % 2 === 1 ? sixteenth * snareSwing * 0.5 : 0;
      const hihatOffset = step % 2 === 1 ? sixteenth * hihatSwing * 0.5 : 0;

      onStep(step);
      playStep(step, time, { kickOffset, snareOffset, hihatOffset });

      stepCounter.current = (step + 1) % STEPS;
    }, "16n");

    Tone.Transport.start();
    setIsPlaying(true);
  };

  // --------------------------
  // STOP
  // --------------------------
  const stop = () => {
    if (!Tone) return;

    Tone.Transport.stop();
    Tone.Transport.cancel();
    stepCounter.current = 0;

    onStep(-1);
    setIsPlaying(false);
  };

  // --------------------------
  // UI
  // --------------------------
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

      <div style={{ marginTop: "10px" }}>
        <label>Master Vol (dB): </label>
        <input
          type="range"
          min="-30"
          max="6"
          value={masterVolume}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
          step="1"
          style={{ width: "200px" }}
        />
        {masterVolume} dB
      </div>
    </div>
  );
}
