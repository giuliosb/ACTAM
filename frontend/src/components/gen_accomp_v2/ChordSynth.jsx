import { useEffect, useMemo, useRef } from "react";

export const CHORD_INSTRUMENTS = [
  { id: "real-piano", label: "Grand Piano (real)" },
  { id: "real-strings", label: "String Ensemble (real)" },
  { id: "real-guitar", label: "Acoustic Guitar (real)" },
  { id: "fm", label: "FM Piano" },
  { id: "sinepad", label: "Sine Pad" },
  { id: "saw", label: "Saw Lead" },
  { id: "organ", label: "Organ" },
  { id: "piano", label: "Digital Piano" },
];

export const DEFAULT_CHORD_SYNTH_SETTINGS = {
  instrument: "real-piano",
  attack: 0.01,
  decay: 0.25,
  sustain: 0.6,
  release: 2.5,
  filterCutoff: 4500,
  reverbDecay: 2.4,
};

const SAMPLER_LIBRARY = {
  "real-piano": {
    urls: {
      A1: "A1.mp3",
      C2: "C2.mp3",
      E2: "E2.mp3",
      A2: "A2.mp3",
      C3: "C3.mp3",
      E3: "E3.mp3",
      A3: "A3.mp3",
      C4: "C4.mp3",
      E4: "E4.mp3",
      A4: "A4.mp3",
      C5: "C5.mp3",
      E5: "E5.mp3",
    },
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    volume: -4,
    release: 3.5,
  },
  "real-strings": {
    urls: {
      C2: "C2.mp3",
      G2: "G2.mp3",
      C3: "C3.mp3",
      G3: "G3.mp3",
      C4: "C4.mp3",
      G4: "G4.mp3",
      C5: "C5.mp3",
      G5: "G5.mp3",
    },
    baseUrl:
      "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/string_ensemble_1-mp3/",
    volume: -6,
    attack: 0.04,
    release: 4,
  },
  "real-guitar": {
    urls: {
      C2: "C2.mp3",
      G2: "G2.mp3",
      C3: "C3.mp3",
      E3: "E3.mp3",
      A3: "A3.mp3",
      C4: "C4.mp3",
      E4: "E4.mp3",
      A4: "A4.mp3",
      C5: "C5.mp3",
    },
    baseUrl:
      "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3/",
    volume: -3,
    attack: 0.015,
    release: 3,
  },
};

const VALID_INSTRUMENT_IDS = new Set(CHORD_INSTRUMENTS.map((opt) => opt.id));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const safeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const createSynth = (Tone, instrument, envelope, onReady, onError) => {
  const env = envelope || DEFAULT_CHORD_SYNTH_SETTINGS;
  const samplerDef = SAMPLER_LIBRARY[instrument];

  if (samplerDef) {
    try {
      const sampler = new Tone.Sampler({
        urls: samplerDef.urls,
        baseUrl: samplerDef.baseUrl,
        attack: samplerDef.attack ?? env.attack,
        release: samplerDef.release ?? env.release,
        onload: () => onReady?.(),
        onerror: (err) => onError?.(err),
      });

      if (typeof samplerDef.volume === "number") {
        sampler.volume.value = samplerDef.volume;
      }

      return sampler;
    } catch (err) {
      onError?.(err);
    }
  }

  switch (instrument) {
    case "sinepad":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: env,
      });
    case "saw":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: env,
      });
    case "organ":
      return new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        envelope: env,
      });
    case "piano":
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 10,
        envelope: env,
      });
    case "fm":
    default:
      return new Tone.PolySynth(Tone.FMSynth, {
        envelope: env,
      });
  }
};

const disposeChain = (chain) => {
  if (!chain) return;
  chain.synth?.dispose();
  chain.filter?.dispose();
  chain.chorus?.dispose();
  chain.reverb?.dispose();
  chain.panner?.dispose();
  chain.limiter?.dispose();
};

/**
 * Headless component that builds the chord synth chain once Tone is ready.
 * The resulting chain is stored in the provided ref so outer components
 * can trigger notes without duplicating setup logic. Instrument changes
 * recreate the underlying synth.
 */
export default function ChordSynth({ Tone, targetRef, settings }) {
  const chordChainRef = useRef(null);
  const normalizedSettings = useMemo(() => {
    const merged = {
      ...DEFAULT_CHORD_SYNTH_SETTINGS,
      ...(settings || {}),
    };

    const attack = clamp(
      safeNumber(merged.attack, DEFAULT_CHORD_SYNTH_SETTINGS.attack),
      0.001,
      5
    );
    const decay = clamp(
      safeNumber(merged.decay, DEFAULT_CHORD_SYNTH_SETTINGS.decay),
      0.01,
      5
    );
    const sustain = clamp(
      safeNumber(merged.sustain, DEFAULT_CHORD_SYNTH_SETTINGS.sustain),
      0,
      1
    );
    const release = clamp(
      safeNumber(merged.release, DEFAULT_CHORD_SYNTH_SETTINGS.release),
      0.05,
      8
    );
    const filterCutoff = clamp(
      safeNumber(
        merged.filterCutoff,
        DEFAULT_CHORD_SYNTH_SETTINGS.filterCutoff
      ),
      200,
      8000
    );
    const reverbDecay = clamp(
      safeNumber(merged.reverbDecay, DEFAULT_CHORD_SYNTH_SETTINGS.reverbDecay),
      0.1,
      12
    );

    const instrument = VALID_INSTRUMENT_IDS.has(merged.instrument)
      ? merged.instrument
      : DEFAULT_CHORD_SYNTH_SETTINGS.instrument;

    return {
      instrument,
      attack,
      decay,
      sustain,
      release,
      filterCutoff,
      reverbDecay,
    };
  }, [settings]);

  useEffect(() => {
    if (!Tone) return;

    disposeChain(chordChainRef.current);

    const filter = new Tone.Filter(normalizedSettings.filterCutoff, "lowpass");
    const chorus = new Tone.Chorus(1.6, 1.2).start();
    chorus.wet.value = 0.35;

    const reverb = new Tone.Reverb({
      decay: normalizedSettings.reverbDecay,
      preDelay: 0.01,
    });
    const panner = new Tone.Panner(0);
    const limiter = new Tone.Limiter(-1);

    const isSampler = !!SAMPLER_LIBRARY[normalizedSettings.instrument];
    let chain;
    const markReady = () => {
      if (chain) chain.ready = true;
    };

    const synth = createSynth(
      Tone,
      normalizedSettings.instrument,
      {
        attack: normalizedSettings.attack,
        decay: normalizedSettings.decay,
        sustain: normalizedSettings.sustain,
        release: normalizedSettings.release,
      },
      isSampler ? markReady : undefined,
      (err) => {
        console.warn("Chord sampler failed to load", err);
        markReady();
      }
    );

    synth.chain(filter, chorus, reverb, panner, limiter, Tone.Destination);

    chain = {
      synth,
      filter,
      chorus,
      reverb,
      panner,
      limiter,
      instrument: normalizedSettings.instrument,
      ready: isSampler ? !!synth?.loaded : true,
    };

    chordChainRef.current = chain;

    if (targetRef) targetRef.current = chordChainRef.current;
  }, [Tone, normalizedSettings, targetRef]);

  useEffect(() => {
    return () => {
      disposeChain(chordChainRef.current);
      chordChainRef.current = null;
      if (targetRef) targetRef.current = null;
    };
  }, [targetRef]);

  return null;
}
