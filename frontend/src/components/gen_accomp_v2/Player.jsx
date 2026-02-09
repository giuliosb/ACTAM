import {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { DEFAULT_STEPS } from "./musicConfig";
import ChordSynth, {
  CHORD_INSTRUMENTS,
  DEFAULT_CHORD_SYNTH_SETTINGS,
} from "./ChordSynth.jsx";
import Drumshynt, {
  DEFAULT_DRUM_SOUND_SELECTION,
  DEFAULT_DRUM_SYNTH_SETTINGS,
  DRUM_SOUND_OPTIONS,
} from "./Drumshynt.jsx";


const HUMANIZE_MAX_DELAY = 0.03; // seconds of max note spread inside a chord

export const DRUM_IDS = ["kick", "snare", "hihat", "openhat"];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* -----------------------------------------------
   1. Tone Engine
------------------------------------------------ */
function useToneEngine(bpm, masterVolume) {
  const toneRef = useRef(null);
  const masterCompressor = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (toneRef.current || cancelled) return;

      const Tone = await import("tone");
      if (cancelled) return;

      toneRef.current = Tone;

      masterCompressor.current = new Tone.Compressor({
        threshold: -18,
        ratio: 3,
        attack: 0.003,
        release: 0,
      }).connect(Tone.Destination);

      Tone.Transport.bpm.value = bpm;
      Tone.Destination.volume.value = masterVolume;

      setIsLoaded(true);
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

  const ensureStarted = useCallback(async () => {
    const Tone = toneRef.current;
    if (!Tone) return false;

    // Tone.start() sblocca AudioContext
    await Tone.start();

    setIsAudioReady(true);
    return true;
  }, []);

  const unlockAudioSync = useCallback(() => {
  const Tone = toneRef.current;
  if (!Tone) return false;
  Tone.start(); // niente await: chiamata immediata
  return true;
}, []);


  useEffect(() => {
    if (toneRef.current) toneRef.current.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    if (toneRef.current)
      toneRef.current.Destination.volume.value = masterVolume;
  }, [masterVolume]);

  return { Tone: toneRef.current, isLoaded, isAudioReady, ensureStarted, unlockAudioSync };
}

/* -----------------------------------------------
   2. Transport
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
   3. Player Component
   (sequencer "freezato" al Play)
------------------------------------------------ */
const Player = forwardRef(function Player(
  {
    sequence,
    chords,
    tracks,
    onStep,
    onTracksChange,
    onPlayStateChange,
    steps = DEFAULT_STEPS,
    bpm = 120,
    masterVolume = 0,
    chordVolume = 0,
    chordSynthSettings = DEFAULT_CHORD_SYNTH_SETTINGS,
    drumSoundSelection: externalDrumSoundSelection,
  },
  ref
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [drumSynthSettings, setDrumSynthSettings] = useState(() => ({
    ...DEFAULT_DRUM_SYNTH_SETTINGS,
    soundSelection: { ...DEFAULT_DRUM_SOUND_SELECTION },
  }));

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

  const setDrumSoundSelection = useCallback((drumId, soundId) => {
    setDrumSynthSettings((prev) => {
      const prevSelection =
        prev?.soundSelection || DEFAULT_DRUM_SOUND_SELECTION;
      return {
        ...prev,
        soundSelection: {
          ...prevSelection,
          [drumId]: soundId,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (!externalDrumSoundSelection) return;
    setDrumSynthSettings((prev) => ({
      ...prev,
      soundSelection: {
        ...prev.soundSelection,
        ...externalDrumSoundSelection,
      },
    }));
  }, [externalDrumSoundSelection]);

  const { Tone, isLoaded, isAudioReady, ensureStarted, unlockAudioSync } = useToneEngine(bpm, masterVolume);
  const drumSynthRef = useRef(null);
  const chordSynthRef = useRef(null);

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

  const drumSoundSelection =
    drumSynthSettings.soundSelection || DEFAULT_DRUM_SOUND_SELECTION;

  /* -----------------------------------------------
     Chords (synth unico, con volume globale)
  ------------------------------------------------ */
  const playChord = useCallback(
    (index, freqs, sustain, time) => {
      const chain = chordSynthRef.current;
      if (!chain || !chain.synth) return;
      if (chain.ready === false) return;

    if (!Array.isArray(freqs) || freqs.length === 0) return;

      const vol = chordVolumeRef.current ?? 0;
      chain.synth.volume.value = vol;
      
      const maxSpread = Math.min(
        HUMANIZE_MAX_DELAY,
        Math.max(0, sustain) * 0.45
      );
      const spreadSteps = Math.max(freqs.length - 1, 1);
      const startTime = Number.isFinite(time) ? time : undefined;

      try {
        chain.synth.triggerAttackRelease(freqs, sustain, time);
      } catch (err) {
        console.warn("Chord playback failed", err);
      }
    },
    [chordSynthRef]
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

      const drums = drumSynthRef.current || {};
      if (drums.ready === false) return;

      const triggerDrum = (node, note, duration, when) => {
        if (!node) return;
        try {
          if (typeof node.start === "function") {
            node.start(when);
          } else if (typeof node.triggerAttackRelease === "function") {
            node.triggerAttackRelease(note, duration, when);
          }
        } catch (err) {
          console.warn("Drum trigger failed", err);
        }
      };

      const kick = drums.kick;
      const snare = drums.snare;
      const hihat = drums.hihat;
      const openhat = drums.openhat;

      // volumi drums (live)
      if (kick) kick.volume.value = drumTracks.kick?.volume ?? 0;
      if (snare) snare.volume.value = drumTracks.snare?.volume ?? 0;
      if (hihat) hihat.volume.value = drumTracks.hihat?.volume ?? 0;
      if (openhat) openhat.volume.value = drumTracks.openhat?.volume ?? 0;

      // --- DRUM EVENTS ---
      for (const ev of evs) {
        if (!ev || ev.type !== "drum") continue;
        if (!drumsEnabledGlobal) continue;

        if (ev.drum === "kick") {
          const t = drumTracks.kick || {};
          if (t.enabled === false) continue;
          triggerDrum(kick, "C1", "8n", time);
        }
        if (ev.drum === "snare") {
          const t = drumTracks.snare || {};
          if (t.enabled === false) continue;
          triggerDrum(snare, undefined, "8n", time);
        }
        if (ev.drum === "hihat") {
          const t = drumTracks.hihat || {};
          if (t.enabled === false) continue;
          triggerDrum(hihat, undefined, "8n", time);
        }
        if (ev.drum === "openhat") {
          const t = drumTracks.openhat || {};
          if (t.enabled === false) continue;
          triggerDrum(openhat, undefined, "4n", time);
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
    [playChord]
  );

  const { start, stop } = useTransport(Tone, {
    steps,
    onStep,
    playStep,
    setIsPlaying: setPlaying,
  });

  // Start di alto livello: congela sequenza + avvia transport
  const handleStart = useCallback(async () => {
  if (!isLoaded) return;

  const ok = await ensureStarted();
  if (!ok) return;

  prepareSequenceSnapshot();
  start();
}, [isLoaded, ensureStarted, prepareSequenceSnapshot, start]);


  useImperativeHandle(
    ref,
    () => {
      const createDrumVolumeSnapshot = () => {
        const drums = tracksRef.current?.drums || {};
        return DRUM_IDS.reduce((acc, drumId) => {
          const entry = drums[drumId] || {};
          acc[drumId] = entry.volume ?? 0;
          return acc;
        }, {});
      };

      return {
        getState: () => ({
          bpm,
          masterVolume,
          chordVolume,
          chordSynthSettings,
          chordInstrument: chordSynthSettings.instrument,
          chordInstruments: CHORD_INSTRUMENTS,
          drumVolumes: createDrumVolumeSnapshot(),
          drumSounds: drumSoundSelection,
          isPlaying,
        }),

        unlockAudio: () => {
        // opzionale: evita chiamate prima del load
        if (!isLoaded) return false;
        return unlockAudioSync?.() ?? false;
        },
        play: handleStart,
        stop,
        setDrumSound: (drumId, soundId) => {
          setDrumSoundSelection(drumId, soundId);
        },
      };
    },
    [
      bpm,
      masterVolume,
      chordVolume,
      chordSynthSettings,
      isPlaying,
      handleStart,
      stop,
      drumSoundSelection,
      setDrumSoundSelection,
      isLoaded,
      unlockAudioSync,
    ]
  );

  return (
    <div>
      <Drumshynt
        Tone={Tone}
        targetRef={drumSynthRef}
        settings={drumSynthSettings}
      />
      <ChordSynth
        Tone={Tone}
        targetRef={chordSynthRef}
        settings={chordSynthSettings}
      />
    </div>
  );
});

export default Player;
export { CHORD_INSTRUMENTS, DRUM_SOUND_OPTIONS, DEFAULT_DRUM_SOUND_SELECTION };
