import { useEffect, useMemo, useRef } from "react";

export const CHORD_INSTRUMENTS = [
  { id: "fm", label: "FM Piano" },
  { id: "sinepad", label: "Sine Pad" },
  { id: "saw", label: "Saw Lead" },
  { id: "organ", label: "Organ" },
  { id: "piano", label: "Digital Piano" },
];

export const DEFAULT_CHORD_SYNTH_SETTINGS = {
  instrument: "fm",
  attack: 0.03,
  decay: 0.3,
  sustain: 0.5,
  release: 1,
  filterCutoff: 1500,
  reverbDecay: 3,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const safeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const createSynth = (Tone, instrument, envelope) => {
  const env = envelope || DEFAULT_CHORD_SYNTH_SETTINGS;
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

    return {
      instrument: merged.instrument || DEFAULT_CHORD_SYNTH_SETTINGS.instrument,
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
    const chorus = new Tone.Chorus(4, 2.5).start();
    const reverb = new Tone.Reverb({
      decay: normalizedSettings.reverbDecay,
      preDelay: 0.01,
    });
    const panner = new Tone.Panner(0);
    const limiter = new Tone.Limiter(-1);

    const synth = createSynth(Tone, normalizedSettings.instrument, {
      attack: normalizedSettings.attack,
      decay: normalizedSettings.decay,
      sustain: normalizedSettings.sustain,
      release: normalizedSettings.release,
    });

    synth.chain(filter, chorus, reverb, panner, limiter, Tone.Destination);

    chordChainRef.current = {
      synth,
      filter,
      chorus,
      reverb,
      panner,
      limiter,
      instrument: normalizedSettings.instrument,
    };

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
