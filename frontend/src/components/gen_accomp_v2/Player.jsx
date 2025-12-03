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
    if (toneRef.current)
      toneRef.current.Destination.volume.value = masterVolume;
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
   3. Chord Synth (unico, default)
------------------------------------------------ */
function useChordSynth(Tone) {
  const chordChainRef = useRef(null);

  useEffect(() => {
    if (!Tone) return;
    if (chordChainRef.current) return; // già creato

    const filter = new Tone.Filter(1500, "lowpass");
    const chorus = new Tone.Chorus(4, 2.5).start();
    const reverb = new Tone.Reverb({ decay: 3, preDelay: 0.01 });
    const panner = new Tone.Panner(0);
    const limiter = new Tone.Limiter(-1);

    const synth = new Tone.PolySynth(Tone.FMSynth, {
      envelope: { attack: 0.03, decay: 0.3, sustain: 0.5, release: 1.0 },
    });

    synth.chain(filter, chorus, reverb, panner, limiter, Tone.Destination);

    chordChainRef.current = {
      synth,
      filter,
      chorus,
      reverb,
      panner,
      limiter,
    };
  }, [Tone]);

  useEffect(() => {
    return () => {
      const chain = chordChainRef.current;
      if (!chain) return;
      chain.synth?.dispose();
      chain.filter?.dispose();
      chain.chorus?.dispose();
      chain.reverb?.dispose();
      chain.panner?.dispose();
      chain.limiter?.dispose();
    };
  }, []);

  return chordChainRef;
}

/* -----------------------------------------------
   4. Transport
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
   5. Player Component
------------------------------------------------ */
export default function Player({
  sequence,
  chords,
  tracks,
  onStep,
  onTracksChange,
})
  
  {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(0);

  const { Tone, isReady } = useToneEngine(bpm, masterVolume);
  const { kick, snare, hihat } = useDrums(Tone);
  const chordSynth = useChordSynth(Tone);

  // refs per ultima versione di sequence/chords/tracks/bpm
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

    const handleDrumVolumeChange = (drumId, value) => {
    if (!onTracksChange) return;
    const vol = Number(value);

    onTracksChange((prev) => {
      const prevDrums = prev.drums || {};
      const prevDrumTrack = prevDrums[drumId] || {};

      return {
        ...prev,
        drums: {
          ...prevDrums,
          [drumId]: {
            ...prevDrumTrack,
            volume: vol,
          },
        },
      };
    });
  };


  /* -----------------------------------------------
     Chords (synth unico, senza parametri per track)
  ------------------------------------------------ */
  const playChord = useCallback(
    (index, freqs, sustain, time) => {
      const chain = chordSynth.current;
      if (!chain) return;

      const tracks = tracksRef.current || {};
      const chordTracks = tracks.chords || [];
      const t = chordTracks[index] ?? {};

      // manteniamo solo il mute per track
      if (t.enabled === false) return;

      chain.synth.triggerAttackRelease(freqs, sustain, time);
    },
    [chordSynth]
  );

  /* -----------------------------------------------
     Step playback (DRUMS + CHORDS)
  ------------------------------------------------ */
  const playStep = useCallback(
    (step, time) => {
      const sequence = sequenceRef.current || [];
      const tracks = tracksRef.current || {};
      const chords = chordsRef.current || [];
      const bpm = bpmRef.current || 120;

      const evs = sequence[step] || [];
      const drumTracks = tracks.drums || {};

      const drumsEnabledGlobal =
        drumTracks.enabled === undefined ? true : drumTracks.enabled;

      // volumi drums
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

          if (!chord) continue;

          const chordTrack = tracks.chords?.[ev.chordIndex] ?? {};
          if (chordTrack.enabled === false) continue;

          const freqs = chord.notes.map((n) => n.freq);
          const stepDur = 60 / bpm / 4;
          const sustain = Math.max(0.03, ev.sustain * stepDur);

          playChord(ev.chordIndex, freqs, sustain, time);
          break; // un solo accordo per step
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

            <div style={{ marginTop: "10px" }}>
        <h4>Drum Volumes (dB)</h4>
        {["kick", "snare", "hihat"].map((drumId) => {
          const drumTracks = tracks?.drums || {};
          const vol = drumTracks[drumId]?.volume ?? 0;

          return (
            <div key={drumId} style={{ marginBottom: "6px" }}>
              <label
                style={{
                  width: "60px",
                  display: "inline-block",
                  textTransform: "capitalize",
                }}
              >
                {drumId}:
              </label>
              <input
                type="range"
                min="-30"
                max="6"
                step="1"
                value={vol}
                onChange={(e) =>
                  handleDrumVolumeChange(drumId, e.target.value)
                }
                style={{ width: "200px" }}
              />
              <span style={{ marginLeft: "8px" }}>{vol} dB</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
