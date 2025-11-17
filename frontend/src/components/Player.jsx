import { useRef, useState, useEffect } from "react";

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
  const masterCompressor = useRef(null);

  // INIT DRUMS
  const initDrums = () => {
    if (kick.current) return;

    kick.current = new Tone.MembraneSynth().toDestination();
    snare.current = new Tone.NoiseSynth().toDestination();
    hihat.current = new Tone.MetalSynth().toDestination();
  };

  // MASTER VOLUME
  useEffect(() => {
    if (Tone) {
      Tone.Destination.volume.value = masterVolume;
    }
  }, [masterVolume]);

  // SYNTH FACTORY
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

      default:
        return new Tone.PolySynth(Tone.FMSynth, {
          envelope: { attack: 0.03, decay: 0.3, sustain: 0.5, release: 1.0 },
        });
    }
  };

  // CREATE / SYNC CHORD CHAINS
  useEffect(() => {
    if (!Tone || !isPlaying) return;

    for (let i = 0; i < chords.length; i++) {
      const track = tracks.chords?.[i] ?? {};
      const instrument = track.instrument || "fm";

      const mustRecreate =
        !chordChains.current[i] ||
        chordChains.current[i].instrument !== instrument;

      if (mustRecreate) {
        if (chordChains.current[i]) {
          const old = chordChains.current[i];
          old.synth.dispose();
          old.filter.dispose();
          old.chorus.dispose();
          old.reverb.dispose();
          old.panner.dispose();
          old.limiter.dispose();
        }

        const filter = new Tone.Filter(1500, "lowpass");
        const chorus = new Tone.Chorus(4, 2.5).start();
        const reverb = new Tone.Reverb({ decay: 3, preDelay: 0.01 });
        const panner = new Tone.Panner(0);
        const limiter = new Tone.Limiter(-1);

        const synth = createSynth(instrument);

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
      if (old) {
        old.synth.dispose();
        old.filter.dispose();
        old.chorus.dispose();
        old.reverb.dispose();
        old.panner.dispose();
        old.limiter.dispose();
      }
    }
  }, [chords.length, tracks.chords, isPlaying]);

  // CLEANUP
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

  // PLAY CHORD
  const playChord = (index, freqs, sustain, time) => {
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
      }
    });

    chain.synth.triggerAttackRelease(freqs, sustain, time);
  };

  // PLAY STEP
  const playStep = (step, time, offsets = {}) => {
    const evts = sequence[step] || [];

    const drumTracks = tracks.drums || {};
    if (kick.current) kick.current.volume.value = drumTracks.kick?.volume ?? 0;
    if (snare.current) snare.current.volume.value = drumTracks.snare?.volume ?? 0;
    if (hihat.current) hihat.current.volume.value = drumTracks.hihat?.volume ?? 0;

    for (const ev of evts) {
      if (ev.type === "drum") {
        if (ev.drum === "kick")
          kick.current.triggerAttackRelease("C1", "8n", time);

        if (ev.drum === "snare")
          snare.current.triggerAttackRelease("8n", time);

        if (ev.drum === "hihat")
          hihat.current.triggerAttackRelease("16n", time);
      }
    }

    for (const ev of evts) {
      if (ev.type === "chord" && ev.start) {
        const chord = chords[ev.chordIndex];
        if (!chord) break;

        const freqs = chord.notes.map(n => n.freq);
        const stepDur = 60 / bpm / 4;
        const sustain = Math.max(0.03, ev.sustain * stepDur);

        playChord(ev.chordIndex, freqs, sustain, time);
        break;
      }
    }
  };

  // START
  const start = async () => {
    if (!Tone) {
      Tone = await import("tone");
      await Tone.start();
    }

    initDrums();
    Tone.Transport.bpm.value = bpm;

    // MASTER COMPRESSOR (ROUTING SICURO)
    if (!masterCompressor.current) {
      masterCompressor.current = new Tone.Compressor({
        threshold: -18,
        ratio: 3,
        attack: 0.003,
        release: 0.25,
      }).connect(Tone.Destination);
    }

    stepCounter.current = 0;

    if (transportEvent.current) {
      Tone.Transport.clear(transportEvent.current);
    }

    transportEvent.current = Tone.Transport.scheduleRepeat((time) => {
      const s = stepCounter.current;

      onStep(s);
      playStep(s, time);

      stepCounter.current = (s + 1) % STEPS;
    }, "16n");

    Tone.Transport.start();
    setIsPlaying(true);
  };

  // STOP
  const stop = () => {
    if (!Tone) return;
    Tone.Transport.stop();
    Tone.Transport.cancel();
    stepCounter.current = 0;
    onStep(-1);
    setIsPlaying(false);
  };

  // UI
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
