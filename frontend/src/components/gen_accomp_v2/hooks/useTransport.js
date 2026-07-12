import { useCallback, useEffect, useRef } from "react";

/**
 * Owns the Tone.Transport loop used by the step sequencer.
 *
 * Variables:
 * - Tone: Dynamically loaded Tone.js module. The hook is inactive until this exists.
 * - steps: Number of sequencer steps before wrapping to zero.
 * - onStep: Callback notified with the current step index. Receives -1 when stopped.
 * - playStep: Callback that triggers the musical events for a step.
 * - setIsPlaying: State setter/wrapper used to notify local state and parent state.
 * - transportEventRef: Tone.Transport event id returned by scheduleRepeat.
 * - stepCounterRef: Mutable step index that advances independently of React renders.
 */
export function useTransport(Tone, { steps, onStep, playStep, setIsPlaying }) {
  const transportEventRef = useRef(null);
  const stepCounterRef = useRef(0);

  const clearTransportEvent = useCallback(() => {
    if (!Tone || transportEventRef.current === null) return;

    Tone.Transport.clear(transportEventRef.current);      //TODO what is this Transport.clear()
    transportEventRef.current = null;
  }, [Tone]);

  const resetTransport = useCallback(() => {
    if (!Tone) return;

    Tone.Transport.stop();
    Tone.Transport.cancel();                  //TODO what is this Transport.cancel()
    Tone.Transport.position = "0:0:0";
    stepCounterRef.current = 0;
  }, [Tone]);

  const setupLoop = useCallback(() => {
    if (!Tone || !Number.isFinite(steps) || steps <= 0) return;

    clearTransportEvent();
    resetTransport();

    //TODO what is this Transport.scheduleRepeat()
    transportEventRef.current = Tone.Transport.scheduleRepeat((time) => {
      const step = stepCounterRef.current;

      onStep(step);
      playStep(step, time);

      stepCounterRef.current = (step + 1) % steps;
    }, "16n", 0);
  }, [Tone, steps, onStep, playStep, clearTransportEvent, resetTransport]);

  const start = useCallback(() => {
    if (!Tone) return;

    setupLoop();
    Tone.Transport.start();
    setIsPlaying(true);
  }, [Tone, setupLoop, setIsPlaying]);        //TODO what are this return values, how does this work

  const stop = useCallback(() => {
    if (!Tone) return;

    resetTransport();
    clearTransportEvent();
    onStep(-1);           //TODO: Why?
    setIsPlaying(false);
  }, [Tone, resetTransport, clearTransportEvent, onStep, setIsPlaying]);  //TODO what are this return values

  useEffect(() => {
    return () => {
      if (!Tone) return;
      resetTransport();
      clearTransportEvent();
    };
  }, [Tone, resetTransport, clearTransportEvent]);

  return { start, stop };
}
