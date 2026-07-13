import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads Tone.js once, configures the global transport/output, and exposes audio-unlock helpers.
 *
 * Variables:
 * - bpm: Current beats per minute. Written to Tone.Transport.bpm whenever it changes.
 * - masterVolume: Current global output volume in dB. Written to Tone.Destination.volume.
 * - toneRef: Stable reference to the dynamically imported Tone module.
 * - masterCompressorRef: Reference to the master compressor node, disposed on unmount.
 * - isLoaded: True after Tone.js has been imported and the audio graph has been initialized.
 * - isAudioReady: True after Tone.start() succeeds. Browsers require this after a user gesture.
 */
export function useToneEngine(bpm, masterVolume) {
  const toneRef = useRef(null);
  const masterCompressorRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTone() {
      if (toneRef.current || cancelled) return;

      const Tone = await import("tone");
      if (cancelled) return;

      toneRef.current = Tone;
      masterCompressorRef.current = new Tone.Compressor({
        threshold: -18,
        ratio: 3,
        attack: 0.003,
        release: 0,
      }).connect(Tone.Destination);

      Tone.Transport.bpm.value = bpm;
      Tone.Destination.volume.value = masterVolume;
      setIsLoaded(true);
    }

    loadTone();

    return () => {
      cancelled = true;

      const Tone = toneRef.current;
      if (Tone) {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      }

      masterCompressorRef.current?.dispose();
      masterCompressorRef.current = null;
    };
  }, []); // Load Tone.js only once. Runtime bpm/masterVolume updates are handled below.

  useEffect(() => {
    if (toneRef.current) toneRef.current.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    if (toneRef.current) toneRef.current.Destination.volume.value = masterVolume;
  }, [masterVolume]);

  const ensureStarted = useCallback(async () => {
    const Tone = toneRef.current;
    if (!Tone) return false;

    await Tone.start();
    setIsAudioReady(true);
    return true;
  }, []);
  const unlockAudioSync = useCallback(() => {
    const Tone = toneRef.current;
    if (!Tone) return false;

    Tone.start();
    setIsAudioReady(true);
    return true;
  }, []);

  return {
    Tone: toneRef.current,
    isLoaded,
    isAudioReady,
    ensureStarted,
    unlockAudioSync,
  };
}
