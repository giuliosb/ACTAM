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
        release: 0,
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
      envelope: { attack: 0.03, decay: 0.3, sustain: 0.5, release: 0 },
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

  const setupLoop = useCallback(() => {
    if (!Tone) return;

    // cancella eventuali eventi vecchi
    if (transportEvent.current) {
      Tone.Transport.clear(transportEvent.current);
      transportEvent.current = null;
    }

    // azzera posizione/ticks
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = "0:0:0";
    // (volendo: Tone.Transport.ticks = 0;)

    stepCounter.current = 0;

    // nuovo scheduleRepeat pulito
    transportEvent.current = Tone.Transport.scheduleRepeat(
      (time) => {
        const s = stepCounter.current;

        if (!Number.isFinite(steps) || steps <= 0) return;

        onStep(s);
        playStep(s, time);

        stepCounter.current = (s + 1) % steps;
      },
      "16n",
      0
    );
  }, [Tone, steps, onStep, playStep]);

  const start = useCallback(() => {
    if (!Tone) return;

    setupLoop();

    // partiamo da zero, senza offset
    Tone.Transport.start();
    setIsPlaying(true);
  }, [Tone, setupLoop, setIsPlaying]);

  const stop = useCallback(() => {
    if (!Tone) return;

    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = "0:0:0";
    // (volendo: Tone.Transport.ticks = 0;)

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
      Tone.Transport.stop();
      Tone.Transport.cancel();
      if (transportEvent.current) {
        Tone.Transport.clear(transportEvent.current);
        transportEvent.current = null;
      }
    };
  }, [Tone]);

  return { start, stop };
}


/* -----------------------------------------------
   5. Player Component
   (sequencer "freezato" al Play)
------------------------------------------------ */
export default function Player({
  sequence,
  chords,
  tracks,
  onStep,
  onTracksChange,
  onPlayStateChange,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(0);
  const [chordVolume, setChordVolume] = useState(0); // dB per gli accordi

  // wrapper che aggiorna stato locale + notifica il parent
  const setPlaying = useCallback(
    (value) => {
      setIsPlaying(value);
      if (typeof onPlayStateChange === "function") {
        onPlayStateChange(value);
      }
    },
    [onPlayStateChange]
  );

  const { Tone, isReady } = useToneEngine(bpm, masterVolume);
  const { kick, snare, hihat } = useDrums(Tone);
  const chordSynth = useChordSynth(Tone);

  // snapshot fisso di sequence/chords (congelato al Play)
  const sequenceRef = useRef(Array.isArray(sequence) ? sequence : []);
  const chordsRef = useRef(Array.isArray(chords) ? chords : []);

  // parametri che restano live
  const tracksRef = useRef(tracks || {});
  const bpmRef = useRef(bpm);
  const chordVolumeRef = useRef(chordVolume);

  useEffect(() => {
    tracksRef.current = tracks || {};
  }, [tracks]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    chordVolumeRef.current = chordVolume;
  }, [chordVolume]);

  // snapshot di sequenza + accordi al momento del Play
  const prepareSequenceSnapshot = useCallback(() => {
    sequenceRef.current = Array.isArray(sequence) ? sequence : [];
    chordsRef.current = Array.isArray(chords) ? chords : [];
  }, [sequence, chords]);

  const handleDrumVolumeChange = (drumId, value) => {
    if (!onTracksChange) return;
    const vol = Number(value);

    onTracksChange((prev) => {
      const safePrev = prev || {};
      const prevDrums = safePrev.drums || {};
      const prevDrumTrack = prevDrums[drumId] || {};

      return {
        ...safePrev,
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
     Chords (synth unico, con volume globale)
  ------------------------------------------------ */
  const playChord = useCallback(
  (index, freqs, sustain, time) => {
    const chain = chordSynth.current;
    if (!chain) return;

    if (!Array.isArray(freqs) || freqs.length === 0) return;

    const vol = chordVolumeRef.current ?? 0;
    chain.synth.volume.value = vol;

    chain.synth.triggerAttackRelease(freqs, sustain, time);
  },
  [chordSynth]
);


  /* -----------------------------------------------
     Step playback (DRUMS + CHORDS)
     usa sempre sequenceRef/chordsRef (snapshot)
  ------------------------------------------------ */
  const playStep = useCallback(
    (step, time) => {
      const sequenceSnap = Array.isArray(sequenceRef.current)
        ? sequenceRef.current
        : [];
      const tracksSnap = tracksRef.current || {};
      const chordsSnap = Array.isArray(chordsRef.current)
        ? chordsRef.current
        : [];
      const bpmSnap = bpmRef.current || 120;

      const evsRaw = sequenceSnap[step];
      const evs = Array.isArray(evsRaw) ? evsRaw : [];

      const drumTracks = tracksSnap.drums || {};
      const drumsEnabledGlobal =
        drumTracks.enabled === undefined ? true : drumTracks.enabled;

      // volumi drums (live)
      if (kick.current)
        kick.current.volume.value = drumTracks.kick?.volume ?? 0;
      if (snare.current)
        snare.current.volume.value = drumTracks.snare?.volume ?? 0;
      if (hihat.current)
        hihat.current.volume.value = drumTracks.hihat?.volume ?? 0;

      // --- DRUM EVENTS ---
      for (const ev of evs) {
        if (!ev || ev.type !== "drum") continue;
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
          hihat.current?.triggerAttackRelease("8n", time);
        }
      }

      // --- CHORD EVENTS ---
const chordTracksArr = tracksSnap.chords || [];
// unica traccia globale per tutti i chords
const chordGlobalTrack = chordTracksArr[0] || {};
const chordsEnabledGlobal =
  chordGlobalTrack.enabled === undefined
    ? true
    : chordGlobalTrack.enabled;

for (const ev of evs) {
  if (!ev || ev.type !== "chord" || !ev.start) continue;

  // se la traccia globale è mutata, non suoniamo alcun accordo
  if (!chordsEnabledGlobal) break;

  const chord = chordsSnap[ev.chordIndex];
  if (!chord) continue;

  // opzionale: se in futuro vuoi un flag per singolo chord (es. chords[i].enabled = false)
  if (chord.enabled === false) continue;

  const notes = Array.isArray(chord.notes) ? chord.notes : [];
  if (notes.length === 0) continue;

  const freqs = notes
    .map(
      (n) =>
        n &&
        typeof n.freq === "number" &&
        n.freq > 0 &&
        n.freq
    )
    .filter(Boolean);

  if (freqs.length === 0) continue;

  const stepDur = 60 / bpmSnap / 4;
  const sustainFactor =
    typeof ev.sustain === "number" && isFinite(ev.sustain)
      ? ev.sustain
      : 1;
  const sustain = Math.max(0.03, sustainFactor * stepDur);

  playChord(ev.chordIndex, freqs, sustain, time);
  break; // un solo accordo per step
}

    },
    [kick, snare, hihat, playChord]
  );

  const { start, stop } = useTransport(Tone, {
    steps: STEPS,
    onStep,
    playStep,
    setIsPlaying: setPlaying,
  });

  // Start di alto livello: congela sequenza + avvia transport
  const handleStart = useCallback(() => {
    if (!isReady) return;
    prepareSequenceSnapshot();
    start();
  }, [isReady, prepareSequenceSnapshot, start]);

  return (
    <div style={{ marginBottom: "20px" }}>
      <button onClick={isPlaying ? stop : handleStart} disabled={!isReady}>
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

      <div style={{ marginTop: "10px" }}>
        <h4>Chord Volume (dB)</h4>
        <input
          type="range"
          min="-30"
          max="6"
          step="1"
          value={chordVolume}
          onChange={(e) => setChordVolume(Number(e.target.value))}
          style={{ width: "200px" }}
        />
        <span style={{ marginLeft: "8px" }}>{chordVolume} dB</span>
      </div>
    </div>
  );
}
