import { useEffect, useMemo, useRef } from "react";

export const DRUM_SOUND_OPTIONS = {
  kick: [
    {
      id: "kick-cr78",
      label: "CR-78",
      url: "/samples/kick/Kick1.wav",
      volume: -2,
    },
    {
      id: "kick-808",
      label: "TR-808",
      url: "/samples/kick/Kick2.wav",
      volume: -1,
    },
    {
      id: "kick-909",
      label: "TR-909",
      url: "/samples/kick/Kick3.wav",
      volume: -1,
    },
  ],
  snare: [
    {
      id: "snare-cr78",
      label: "CR-78",
      url: "/samples/snare/SN1.wav",
      volume: -4,
    },
    {
      id: "snare-808",
      label: "TR-808",
      url: "samples/snare/SN2.wav",
      volume: -3,
    },
    {
      id: "snare-909",
      label: "TR-909",
      url: "samples/snare/SN3.wav",
      volume: -3,
    },
  ],
  hihat: [
    {
      id: "hihat-cr78",
      label: "CR-78",
      url: "samples/clh/CLH1.wav",
      volume: -6,
    },
    {
      id: "hihat-808",
      label: "TR-808",
      url: "samples/clh/CLH2.wav",
      volume: -5,
    },
    {
      id: "hihat-909",
      label: "TR-909",
      url: "samples/clh/CLH3.wav",
      volume: -6,
    },
  ],
  openhat: [
    {
      id: "openhat-909",
      label: "TR-909",
      url: "samples/oh/OH1.wav",
      volume: -4,
    },
    {
      id: "openhat-909.2",
      label: "TR-909.2",
      url: "samples/oh/OH2.wav",
      volume: -6,
      playbackRate: 0.95,
    },
    {
      id: "openhat-cr78",
      label: "CR-78",
      url: "samples/oh/OH3.wav",
      volume: -5,
      playbackRate: 1.05,
    },
  ],
};

export const DEFAULT_DRUM_SOUND_SELECTION = Object.entries(DRUM_SOUND_OPTIONS).reduce(
  (acc, [drumId, options]) => {
    acc[drumId] = options?.[0]?.id || "";
    return acc;
  },
  {}
);

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
  soundSelection: DEFAULT_DRUM_SOUND_SELECTION,
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
    const desiredSelection = {
      ...DEFAULT_DRUM_SOUND_SELECTION,
      ...(merged.soundSelection || {}),
    };
    const soundSelection = Object.entries(DRUM_SOUND_OPTIONS).reduce(
      (acc, [drumId, options]) => {
        const wanted = desiredSelection[drumId];
        const valid = options.some((opt) => opt.id === wanted);
        acc[drumId] = valid
          ? wanted
          : DEFAULT_DRUM_SOUND_SELECTION[drumId] || options?.[0]?.id || "";
        return acc;
      },
      {}
    );

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
      soundSelection,
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

    const createSamplePlayer = (drumId, soundOption, fallbackOption) => {
      if (!soundOption?.url) return null;

      try {
        pendingLoads += 1;
        const player = new Tone.Player({
          url: soundOption.url,
          onload: markReady,
          onerror: (err) => {
            console.warn(`Drum sample ${drumId} (${soundOption.id}) failed to load`, err);
            markReady();
            if (chainRef.current) chainRef.current[drumId]?.dispose?.();
            if (fallbackOption) {
              const fb = createSamplePlayer(drumId, fallbackOption);
              if (chainRef.current) chainRef.current[drumId] = fb;
            }
          },
        }).connect(bus);

        if (typeof soundOption.volume === "number") {
          player.volume.value = soundOption.volume;
        }

        if (typeof soundOption.playbackRate === "number") {
          player.playbackRate = soundOption.playbackRate;
        }

        return player;
      } catch (err) {
        console.warn(`Drum sample ${drumId} (${soundOption?.id}) initialization failed`, err);
        markReady();
        return null;
      }
    };

    const selectOption = (drumId) => {
      const selection = normalizedSettings.soundSelection || {};
      const options = DRUM_SOUND_OPTIONS[drumId] || [];
      const selectedId = selection[drumId];
      return options.find((opt) => opt.id === selectedId) || options[0];
    };

    const buildDrumNode = (drumId) => {
      const options = DRUM_SOUND_OPTIONS[drumId] || [];
      const option = selectOption(drumId);
      const fallbackOpt = options.find((opt) => opt.id !== option?.id);
      const node = createSamplePlayer(drumId, option, fallbackOpt);
      if (node) return node;

      if (fallbackOpt) return createSamplePlayer(drumId, fallbackOpt);

      return null;
    };

    const kick = buildDrumNode("kick");
    const snare = buildDrumNode("snare");
    const hihat = buildDrumNode("hihat");
    const openhat = buildDrumNode("openhat");

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
