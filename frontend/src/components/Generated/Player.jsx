import { useRef, useState, useEffect, useCallback } from "react";
import { STEPS } from "./musicConfig";

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
   4. Chord Chains (Persistenti, più stabili)
------------------------------------------------ */
function useChordChains(Tone, chords, chordTracks) {
  const chordChains = useRef([]);

  // chiave che cambia SOLO se cambiano gli strumenti, non i parametri
  const instrumentsKey =
    chordTracks?.map((t) => t?.instrument || "fm").join("|") || "";

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
  }, [Tone, chords.length, instrumentsKey]); // 👈 niente più dip su chordTracks full

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
   5. Transport (reset + pre-roll, senza cancel selvaggio)
------------------------------------------------ */
function useTransport(Tone, { steps, onStep, playStep, setIsPlaying }) {
  const transportEvent = useRef(null);
  const stepCounter = useRef(0);

  const start = useCallback(() => {
    if (!Tone) return;

    stepCounter.current = 0;

    if (transportEvent.current) {
      Tone.Transport.clear(transportEvent.current);
      transportEvent.current = null;
    }

    Tone.Transport.position = "0:0:0";

    transportEvent.current = Tone.Transport.scheduleRepeat(
      (time) => {
        const s = stepCounter.current;
        onStep(s);
        playStep(s, time);
        stepCounter.current = (s + 1) % steps;
      },
      "16n",
      0
    );

    // piccolo pre-roll per evitare primo giro muto / glitch
    Tone.Transport.start("+0.05");

    setIsPlaying(true);
  }, [Tone, onStep, playStep, steps, setIsPlaying]);

  const stop = useCallback(() => {
    if (!Tone) return;

    Tone.Transport.stop();
    if (transportEvent.current) {
      Tone.Transport.clear(transportEvent.current);
      transportEvent.current = null;
    }

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
    };
  }, [Tone]);

  return { start, stop };
}

/* -----------------------------------------------
   6. Player Component (LIVE + TRACK MUTE)
------------------------------------------------ */
export default function Player({ sequence, chords, tracks, onStep }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(0);

  const { Tone, isReady } = useToneEngine(bpm, masterVolume);
  const { kick, snare, hihat } = useDrums(Tone);
  const chordChains = useChordChains(Tone, chords, tracks.chords);

  // 🔁 REF per avere sempre l'ULTIMA versione di sequence / chords / tracks / bpm
  const sequenceRef = useRef(sequence);
  const chordsRef = useRef(chords);
  const tracksRef = useRef(tracks);
  const bpmRef = useRef(bpm);

  useEffect(() => {
    sequenceRef.current = sequence;
  }, [sequence]);

  useEffect(() => {
    chordsRef.current = chords;
  }, [chords]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  /* -----------------------------------------------
     Swing
  ------------------------------------------------ */
  useEffect(() => {
  if (!Tone) return;

  const drum = tracks.drums || {};

  // supponiamo swing ∈ [0,1] per ciascuna sorgente
  const totalSwing =
    (drum.kick?.swing ?? 0) * 0.3 +
    (drum.snare?.swing ?? 0) * 0.3 +
    (drum.hihat?.swing ?? 0) * 0.4;

  // clamp a [0,1] per sicurezza
  const swingAmount = Math.min(1, Math.max(0, totalSwing));

  Tone.Transport.swing = swingAmount;
  Tone.Transport.swingSubdivision = "16n";
}, [Tone, tracks.drums]);

  /* -----------------------------------------------
     Chords
  ------------------------------------------------ */
  const playChord = useCallback(
    (index, freqs, sustain, time) => {
      const chain = chordChains.current[index];
      if (!chain) return;

      const tracks = tracksRef.current || {};
      const t = tracks.chords?.[index] ?? {};

      // se la chord track è mutata → non suona
      if (t.enabled === false) return;

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
    [chordChains]
  );

  /* -----------------------------------------------
     Step playback (DRUMS + CHORDS, con mute)
  ------------------------------------------------ */
  const playStep = useCallback(
    (step, time) => {
      const sequence = sequenceRef.current || [];
      const tracks = tracksRef.current || {};
      const chords = chordsRef.current || [];
      const bpm = bpmRef.current || 120;

      const evs = sequence[step] || [];
      const drumTracks = tracks.drums || {};

      // mute globale drums (opzionale)
      const drumsEnabledGlobal =
        drumTracks.enabled === undefined ? true : drumTracks.enabled;

      // aggiorno i volumi
      if (kick.current)
        kick.current.volume.value = drumTracks.kick?.volume ?? 0;
      if (snare.current)
        snare.current.volume.value = drumTracks.snare?.volume ?? 0;
      if (hihat.current)
        hihat.current.volume.value = drumTracks.hihat?.volume ?? 0;

      // --- DRUM EVENTS ---
      for (const ev of evs) {
        if (ev.type === "drum") {
          if (!drumsEnabledGlobal) continue;

          if (ev.drum === "kick") {
            const t = drumTracks.kick || {};
            if (t.enabled === false) continue;
            kick.current?.triggerAttackRelease("C1", "8n", time);
          }
          if (ev.drum === "snare") {
            const t = drumTracks.snare || {};
            if (t.enabled === false) continue;
            snare.current?.triggerAttackRelease("8n", time);
          }
          if (ev.drum === "hihat") {
            const t = drumTracks.hihat || {};
            if (t.enabled === false) continue;
            hihat.current?.triggerAttackRelease("16n", time);
          }
        }
      }

      // --- CHORD EVENTS ---
      for (const ev of evs) {
        if (ev.type === "chord" && ev.start) {
          const chord = chords[ev.chordIndex];
          if (!chord) break;

          const chordTrack = tracks.chords?.[ev.chordIndex] ?? {};
          if (chordTrack.enabled === false) break;

          const freqs = chord.notes.map((n) => n.freq);
          const stepDur = 60 / bpm / 4;
          const sustain = Math.max(0.03, ev.sustain * stepDur);

          playChord(ev.chordIndex, freqs, sustain, time);
          break;
        }
      }
    },
    [kick, snare, hihat, playChord]
  );

  const { start, stop } = useTransport(Tone, {
    steps: STEPS,
    onStep,
    playStep,
    setIsPlaying,
  });

  return (
    <div style={{ marginBottom: "20px" }}>
      <button onClick={isPlaying ? stop : start} disabled={!isReady}>
        {isPlaying ? "Stop" : "Play"}
      </button>

      <label style={{ marginLeft: "20px" }}>BPM:</label>
      <input
        type="number"
        min="40"
        max="240"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        style={{ width: "60px", margin: "0 10px" }}
      />

      <input
        type="range"
        min="40"
        max="240"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
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
