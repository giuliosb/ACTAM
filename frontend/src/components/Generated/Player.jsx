import { useRef, useState, useEffect, useCallback } from "react";

const STEPS = 16;

/* -----------------------------------------------
   1. Tone Engine
------------------------------------------------ */
function useToneEngine(bpm, masterVolume) {
  const toneRef = useRef(null);
  const masterCompressor = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (toneRef.current || cancelled) return;

      const Tone = await import("tone");
      if (cancelled) return;

      await Tone.start();
      toneRef.current = Tone;

      masterCompressor.current = new Tone.Compressor({
        threshold: -18,
        ratio: 3,
        attack: 0.003,
        release: 0.25,
      }).connect(Tone.Destination);

      Tone.Transport.bpm.value = bpm;
      Tone.Destination.volume.value = masterVolume;

      setIsReady(true);
    })();

    return () => {
      cancelled = true;
      const Tone = toneRef.current;
      if (Tone) {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      }
      masterCompressor.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (toneRef.current) toneRef.current.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    if (toneRef.current) toneRef.current.Destination.volume.value = masterVolume;
  }, [masterVolume]);

  return { Tone: toneRef.current, isReady };
}

/* -----------------------------------------------
   2. Drums
------------------------------------------------ */
function useDrums(Tone) {
  const kick = useRef(null);
  const snare = useRef(null);
  const hihat = useRef(null);

  useEffect(() => {
    if (!Tone) return;
    if (kick.current) return;

    kick.current = new Tone.MembraneSynth().toDestination();
    snare.current = new Tone.NoiseSynth().toDestination();
    hihat.current = new Tone.MetalSynth().toDestination();

    return () => {
      kick.current?.dispose();
      snare.current?.dispose();
      hihat.current?.dispose();
    };
  }, [Tone]);

  return { kick, snare, hihat };
}

/* -----------------------------------------------
   3. Synth Factory
------------------------------------------------ */
function createSynth(Tone, instrument) {
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
    default:
      return new Tone.PolySynth(Tone.FMSynth, {
        envelope: { attack: 0.03, decay: 0.3, sustain: 0.5, release: 1.0 },
      });
  }
}

/* -----------------------------------------------
   4. Chord Chains (Persistenti)
------------------------------------------------ */
function useChordChains(Tone, chords, chordTracks) {
  const chordChains = useRef([]);

  useEffect(() => {
    if (!Tone) return;

    const disposeChain = (chain) => {
      chain?.synth?.dispose();
      chain?.filter?.dispose();
      chain?.chorus?.dispose();
      chain?.reverb?.dispose();
      chain?.panner?.dispose();
      chain?.limiter?.dispose();
    };

    for (let i = 0; i < chords.length; i++) {
      const track = chordTracks?.[i] ?? {};
      const instrument = track.instrument || "fm";

      const needsNew =
        !chordChains.current[i] ||
        chordChains.current[i].instrument !== instrument;

      if (needsNew) {
        if (chordChains.current[i]) disposeChain(chordChains.current[i]);

        const filter = new Tone.Filter(1500, "lowpass");
        const chorus = new Tone.Chorus(4, 2.5).start();
        const reverb = new Tone.Reverb({ decay: 3, preDelay: 0.01 });
        const panner = new Tone.Panner(0);
        const limiter = new Tone.Limiter(-1);

        const synth = createSynth(Tone, instrument);
        synth.chain(filter, chorus, reverb, panner, limiter, Tone.Destination);

        chordChains.current[i] = {
          synth,
          filter,
          chorus,
          reverb,
          panner,
          limiter,
          instrument,
        };
      }
    }

    while (chordChains.current.length > chords.length) {
      const old = chordChains.current.pop();
      if (old) disposeChain(old);
    }
  }, [Tone, chords.length]); // NOTE: chordTracks removed

  useEffect(() => {
    return () => {
      chordChains.current.forEach((c) => {
        if (!c) return;
        c.synth.dispose();
        c.filter.dispose();
        c.chorus.dispose();
        c.reverb.dispose();
        c.panner.dispose();
        c.limiter.dispose();
      });
    };
  }, []);

  return chordChains;
}

/* -----------------------------------------------
   5. Transport
------------------------------------------------ */
function useTransport(Tone, { steps, onStep, playStep, setIsPlaying }) {
  const transportEvent = useRef(null);
  const stepCounter = useRef(0);

  const start = useCallback(() => {
    if (!Tone) return;

    stepCounter.current = 0;

    if (transportEvent.current) {
      Tone.Transport.clear(transportEvent.current);
    }

    transportEvent.current = Tone.Transport.scheduleRepeat((time) => {
      const s = stepCounter.current;
      onStep(s);
      playStep(s, time);
      stepCounter.current = (s + 1) % steps;
    }, "16n");

    Tone.Transport.start();
    setIsPlaying(true);
  }, [Tone, onStep, playStep, steps, setIsPlaying]);

  const stop = useCallback(() => {
    if (!Tone) return;

    Tone.Transport.stop();
    Tone.Transport.cancel();
    stepCounter.current = 0;
    onStep(-1);
    setIsPlaying(false);
  }, [Tone, onStep, setIsPlaying]);

  useEffect(() => {
    return () => {
      if (!Tone) return;

      if (transportEvent.current) {
        Tone.Transport.clear(transportEvent.current);
      }

      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, [Tone]);

  return { start, stop };
}

/* -----------------------------------------------
   6. Player Component
------------------------------------------------ */
export default function Player({ sequence, chords, tracks, onStep }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(0);

  const { Tone, isReady } = useToneEngine(bpm, masterVolume);
  const { kick, snare, hihat } = useDrums(Tone);
  const chordChains = useChordChains(Tone, chords, tracks.chords);

  /* -----------------------------------------------
     🔥 MOD #4 — REAL SWING
  ------------------------------------------------ */
  useEffect(() => {
    if (!Tone) return;

    const drum = tracks.drums || {};

    const totalSwing =
      (drum.kick?.swing ?? 0) * 0.3 +
      (drum.snare?.swing ?? 0) * 0.3 +
      (drum.hihat?.swing ?? 0) * 0.4;

    Tone.Transport.swing = (totalSwing + 1) / 2; // convert -1..1 → 0..1
    Tone.Transport.swingSubdivision = "16n";
  }, [Tone, tracks.drums]);

  /* ----------------------------------------------- */

  const playChord = useCallback(
    (index, freqs, sustain, time) => {
      const chain = chordChains.current[index];
      if (!chain) return;

      const t = tracks.chords?.[index] ?? {};

      chain.filter.frequency.value = t.cutoff ?? 1500;
      chain.chorus.wet.value = t.chorusMix ?? 0.5;
      chain.reverb.wet.value = t.reverbMix ?? 0.3;
      chain.panner.pan.value = t.pan ?? 0;
      chain.synth.volume.value = t.volume ?? -8;

      chain.synth.set({
        detune: t.detune ?? 0,
        envelope: {
          attack: t.attack ?? 0.03,
          decay: t.decay ?? 0.3,
          sustain: t.sustain ?? 0.5,
          release: t.release ?? 1.0,
        },
      });

      chain.synth.triggerAttackRelease(freqs, sustain, time);
    },
    [chordChains, tracks.chords]
  );

  const playStep = useCallback(
    (step, time) => {
      const evs = sequence[step] || [];
      const drum = tracks.drums || {};

      if (kick.current)
        kick.current.volume.value = drum.kick?.volume ?? 0;
      if (snare.current)
        snare.current.volume.value = drum.snare?.volume ?? 0;
      if (hihat.current)
        hihat.current.volume.value = drum.hihat?.volume ?? 0;

      for (const ev of evs) {
        if (ev.type === "drum") {
          if (ev.drum === "kick") kick.current?.triggerAttackRelease("C1", "8n", time);
          if (ev.drum === "snare") snare.current?.triggerAttackRelease("8n", time);
          if (ev.drum === "hihat") hihat.current?.triggerAttackRelease("16n", time);
        }
      }

      for (const ev of evs) {
        if (ev.type === "chord" && ev.start) {
          const chord = chords[ev.chordIndex];
          if (!chord) break;

          const freqs = chord.notes.map((n) => n.freq);
          const stepDur = 60 / bpm / 4;
          const sustain = Math.max(0.03, ev.sustain * stepDur);

          playChord(ev.chordIndex, freqs, sustain, time);
          break;
        }
      }
    },
    [sequence, tracks.drums, chords, bpm, playChord, kick, snare, hihat]
  );

  const { start, stop } = useTransport(Tone, {
    steps: STEPS,
    onStep,
    playStep,
    setIsPlaying,
  });

  return (
    <div style={{ marginBottom: "20px" }}>
      <button
        onClick={isPlaying ? stop : start}
        disabled={!isReady}
      >
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
