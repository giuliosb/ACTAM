import { useEffect, useMemo, useRef } from "react";

export const DEFAULT_DRUM_SYNTH_SETTINGS = {
  busGain: 1,
  reverbDecay: 1.4,
  reverbWet: 0.12,
  kickPitchDecay: 0.02,
  kickOctaves: 6,
  kickDecay: 0.4,
  snareDecay: 0.12,
  hihatDecay: 0.08,
  hihatResonance: 5200,
  openhatDecay: 0.32,
  openhatResonance: 5400,
};

const DRUM_SAMPLE_URLS = {
  kick: "https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3",
  snare: "https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3",
  hihat: "https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3",
  openhat: "https://oramics.github.io/sampled/DM/TR-909/Detroit/samples/hihat-open-1.wav",
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const safeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const disposeChain = (chain) => {
  if (!chain) return;
  chain.kick?.dispose();
  chain.snare?.dispose();
  chain.hihat?.dispose();
  chain.openhat?.dispose();
  chain.bus?.dispose();
  chain.compressor?.dispose();
  chain.reverb?.dispose();
  chain.limiter?.dispose();
};

/**
 * Headless drum section, built once Tone is ready.
 * Follows the same pattern as ChordSynth: build a small FX chain,
 * expose the instruments through the passed ref, and clean up on change/unmount.
 */
export default function Drumshynt({ Tone, targetRef, settings }) {
  const chainRef = useRef(null);

  const normalizedSettings = useMemo(() => {
    const merged = { ...DEFAULT_DRUM_SYNTH_SETTINGS, ...(settings || {}) };
    return {
      busGain: clamp(safeNumber(merged.busGain, DEFAULT_DRUM_SYNTH_SETTINGS.busGain), 0.2, 2.5),
      reverbDecay: clamp(
        safeNumber(merged.reverbDecay, DEFAULT_DRUM_SYNTH_SETTINGS.reverbDecay),
        0.05,
        8
      ),
      reverbWet: clamp(safeNumber(merged.reverbWet, DEFAULT_DRUM_SYNTH_SETTINGS.reverbWet), 0, 1),
      kickPitchDecay: clamp(
        safeNumber(merged.kickPitchDecay, DEFAULT_DRUM_SYNTH_SETTINGS.kickPitchDecay),
        0.001,
        0.5
      ),
      kickOctaves: clamp(
        safeNumber(merged.kickOctaves, DEFAULT_DRUM_SYNTH_SETTINGS.kickOctaves),
        1,
        10
      ),
      kickDecay: clamp(
        safeNumber(merged.kickDecay, DEFAULT_DRUM_SYNTH_SETTINGS.kickDecay),
        0.05,
        2
      ),
      snareDecay: clamp(
        safeNumber(merged.snareDecay, DEFAULT_DRUM_SYNTH_SETTINGS.snareDecay),
        0.02,
        1.2
      ),
      hihatDecay: clamp(
        safeNumber(merged.hihatDecay, DEFAULT_DRUM_SYNTH_SETTINGS.hihatDecay),
        0.02,
        1
      ),
      hihatResonance: clamp(
        safeNumber(merged.hihatResonance, DEFAULT_DRUM_SYNTH_SETTINGS.hihatResonance),
        1000,
        10000
      ),
      openhatDecay: clamp(
        safeNumber(merged.openhatDecay, DEFAULT_DRUM_SYNTH_SETTINGS.openhatDecay),
        0.05,
        3
      ),
      openhatResonance: clamp(
        safeNumber(merged.openhatResonance, DEFAULT_DRUM_SYNTH_SETTINGS.openhatResonance),
        1000,
        10000
      ),
    };
  }, [settings]);

  useEffect(() => {
    if (!Tone) return;

    disposeChain(chainRef.current);

    const reverb = new Tone.Reverb({
      decay: normalizedSettings.reverbDecay,
      preDelay: 0.01,
    });
    reverb.wet.value = normalizedSettings.reverbWet;

    const compressor = new Tone.Compressor({
      threshold: -16,
      ratio: 3.5,
      attack: 0.002,
      release: 0.1,
    });

    const limiter = new Tone.Limiter(-1);
    const bus = new Tone.Gain(normalizedSettings.busGain);
    bus.chain(compressor, reverb, limiter, Tone.Destination);

    const chain = {
      bus,
      compressor,
      reverb,
      limiter,
      ready: false,
    };
    chainRef.current = chain;

    let pendingLoads = 0;

    const markReady = () => {
      pendingLoads = Math.max(0, pendingLoads - 1);
      if (pendingLoads === 0 && chainRef.current) chainRef.current.ready = true;
    };

    const buildSampleOr = (id, createFallback) => {
      const url = DRUM_SAMPLE_URLS[id];
      let fallback;
      const getFallback = () => {
        if (!fallback) fallback = createFallback();
        return fallback;
      };

      if (!url) return getFallback();

      try {
        pendingLoads += 1;
        const player = new Tone.Player({
          url,
          onload: markReady,
          onerror: (err) => {
            console.warn(`Drum sample ${id} failed to load`, err);
            markReady();
            if (chainRef.current) {
              chainRef.current[id]?.dispose?.();
              const fb = getFallback();
              chainRef.current[id] = fb;
            }
          },
        }).connect(bus);
        return player;
      } catch (err) {
        console.warn(`Drum sample ${id} initialization failed`, err);
        markReady();
        return getFallback();
      }
    };

    const kick = buildSampleOr("kick", () =>
      new Tone.MembraneSynth({
        pitchDecay: normalizedSettings.kickPitchDecay,
        octaves: normalizedSettings.kickOctaves,
        envelope: {
          attack: 0.001,
          decay: normalizedSettings.kickDecay,
          sustain: 0.01,
          release: 0.2,
        },
      }).connect(bus)
    );

    const snare = buildSampleOr("snare", () =>
      new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: {
          attack: 0.001,
          decay: normalizedSettings.snareDecay,
          sustain: 0,
          release: 0.08,
        },
      }).connect(bus)
    );

    const hihat = buildSampleOr("hihat", () =>
      new Tone.MetalSynth({
        envelope: {
          attack: 0.001,
          decay: normalizedSettings.hihatDecay,
          release: 0.05,
        },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: normalizedSettings.hihatResonance,
        octaves: 1.5,
        volume: -8,
      }).connect(bus)
    );

    const openhat = buildSampleOr("openhat", () =>
      new Tone.MetalSynth({
        envelope: {
          attack: 0.001,
          decay: normalizedSettings.openhatDecay,
          release: 0.1,
        },
        harmonicity: 4.5,
        modulationIndex: 28,
        resonance: normalizedSettings.openhatResonance,
        octaves: 1.8,
        volume: -6,
      }).connect(bus)
    );

    chain.kick = kick;
    chain.snare = snare;
    chain.hihat = hihat;
    chain.openhat = openhat;
    chain.ready = pendingLoads === 0;
    chainRef.current = chain;

    if (targetRef) targetRef.current = chainRef.current;

    return () => {
      disposeChain(chainRef.current);
      chainRef.current = null;
      if (targetRef) targetRef.current = null;
    };
  }, [Tone, normalizedSettings, targetRef]);

  useEffect(() => {
    return () => {
      disposeChain(chainRef.current);
      chainRef.current = null;
      if (targetRef) targetRef.current = null;
    };
  }, [targetRef]);

  return null;
}
