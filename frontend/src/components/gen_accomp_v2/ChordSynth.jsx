import { useEffect, useMemo, useRef } from "react";

export const CHORD_INSTRUMENTS = [
  { id: "grand-piano", label: "Grand Piano" },
  { id: "electric-piano", label: "Electric Piano" },
  { id: "organ", label: "Jazz Organ" },
  { id: "strings", label: "String Ensemble" },
  { id: "guitar", label: "Acoustic Guitar" },
  { id: "electric-guitar", label: "Electric Guitar" },
  { id: "clarinet", label: "Clarinets" },
  { id: "brass", label: "Brass Ensemble" },
];

export const DEFAULT_CHORD_SYNTH_SETTINGS = {
  instrument: "grand-piano",
  attack: 0.01,
  decay: 0.25,
  sustain: 0.6,
  release: 2.5,
  filterCutoff: 4500,
  reverbDecay: 2.4,
};

const CHORD_SAMPLE_URLS = {
  A0: "A0.mp3",
  C1: "C1.mp3",
  "D#1": "Ds1.mp3",
  "F#1": "Fs1.mp3",
  A1: "A1.mp3",
  C2: "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
};

const SAMPLE_BASE_PATH = "/samples/instruments";

const makeSamplerDefinition = (directory, overrides = {}) => {
  return {
    urls: { ...CHORD_SAMPLE_URLS },
    baseUrl: `${SAMPLE_BASE_PATH}/${directory}/`,
    volume: overrides.volume,
    release: overrides.release,
  };
};

const SAMPLER_LIBRARY = {
  "grand-piano": makeSamplerDefinition("grand-piano"),
  "electric-piano": makeSamplerDefinition("electric-piano"),
  organ: makeSamplerDefinition("jazz-organ"),
  strings: makeSamplerDefinition("cinema-strings"),
  guitar: makeSamplerDefinition("acoustic-guitar"),
  "electric-guitar": makeSamplerDefinition("classic-clean-guitar"),
  clarinet: makeSamplerDefinition("clarinets"),
  brass: makeSamplerDefinition("brass"),
};

const VALID_INSTRUMENT_IDS = new Set(CHORD_INSTRUMENTS.map((opt) => opt.id));

const createSamplerSynth = (Tone, samplerDef, { onReady, onError } = {}) => {
  try {
    const sampler = new Tone.Sampler({
      urls: samplerDef.urls,
      baseUrl: samplerDef.baseUrl,
      onload: () => onReady?.(),
      onerror: (err) => onError?.(err),
    });

    if (typeof samplerDef.volume === "number") {
      sampler.volume.value = samplerDef.volume;
    }

    return sampler;
  } catch (err) {
    onError?.(err);
    return null;
  }
};

const createSynth = (Tone, instrument, callbacks) => {
  const samplerDef = SAMPLER_LIBRARY[instrument];

  if (samplerDef) {
    return createSamplerSynth(Tone, samplerDef, callbacks);
  }

  return new Tone.PolySynth(Tone.FMSynth);
};

const disposeChain = (chain) => {
  if (!chain) return;
  chain.synth?.dispose();
};

export default function ChordSynth({ Tone, targetRef, settings }) {
  const chordChainRef = useRef(null);

  const normalizedSettings = useMemo(() => {
    const instrument = VALID_INSTRUMENT_IDS.has(settings?.instrument)
      ? settings.instrument
      : DEFAULT_CHORD_SYNTH_SETTINGS.instrument;

    return { instrument };
  }, [settings]);

  useEffect(() => {
    if (!Tone) return;

    disposeChain(chordChainRef.current);

    let chain;
    let samplerUsed = !!SAMPLER_LIBRARY[normalizedSettings.instrument];
    let instrumentUsed = normalizedSettings.instrument;

    const markReady = () => {
      if (chain) chain.ready = true;
    };

    const handleSamplerError = (err) => {
      console.warn("Chord sampler failed to load", err);
      markReady();
    };

    const primarySynth = createSynth(Tone, instrumentUsed, {
      onReady: samplerUsed ? markReady : undefined,
      onError: samplerUsed ? handleSamplerError : undefined,
    });

    const synth =
      primarySynth ||
      createSynth(Tone, "fm", {
        onReady: markReady,
      });

    if (!primarySynth && synth) {
      samplerUsed = false;
      instrumentUsed = "fm";
    }

    if (!synth) {
      console.warn("Chord synth not initialized; skipping chain build");
      return;
    }

    if (typeof synth.connect === "function") {
      synth.connect(Tone.Destination);
    }

    chain = {
      synth,
      instrument: instrumentUsed,
      ready: samplerUsed ? !!synth.loaded : true,
    };

    chordChainRef.current = chain;

    if (targetRef) {
      targetRef.current = chain;
    }
  }, [Tone, normalizedSettings, targetRef]);

  useEffect(() => {
    return () => {
      disposeChain(chordChainRef.current);
      chordChainRef.current = null;
      if (targetRef) {
        targetRef.current = null;
      }
    };
  }, [targetRef]);

  return null;
}
