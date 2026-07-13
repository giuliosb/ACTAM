import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { DEFAULT_STEPS } from "./utils/musicConfig.js";
import ChordSynth, {
  CHORD_INSTRUMENTS,
  DEFAULT_CHORD_SYNTH_SETTINGS,
} from "./ChordSynth.jsx";
import Drumshynt, {
  DEFAULT_DRUM_SOUND_SELECTION,
  DEFAULT_DRUM_SYNTH_SETTINGS,
  DRUM_SOUND_OPTIONS,
} from "./Drumshynt.jsx";
import { useToneEngine } from "./hooks/useToneEngine";
import { useTransport } from "./hooks/useTransport";
import {
  DRUM_IDS,
  applyDrumVolumes,
  asArray,
  asObject,
  getChordFrequencies,
  getSustainSeconds,
  triggerDrumNode,
} from "./utils/playerPlayback";

/**
 * Player is the audio-only sequencer bridge between React state and Tone.js.
 *
 * Responsibilities:
 * - Own the current play/stop state.
 * - Load/unlock Tone.js through useToneEngine().
 * - Schedule the transport loop through useTransport().
 * - Keep live refs for mutable playback parameters that should not restart the transport.
 * - Freeze sequence/chord content at Play so editing the grid does not mutate the running loop.
 * - Render Drumshynt and ChordSynth so they can populate their Tone node refs.
 */
const Player = forwardRef(function Player(
  {
    sequence,
    chords,
    tracks,
    onStep,
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
  /**
   * Local playback state.
   *
   * Variables:
   * - isPlaying: True after transport start, false after stop.
   * - drumSynthSettings: Drum synthesis settings plus selected sound ids for each drum lane.
   */
  const [isPlaying, setIsPlaying] = useState(false);
  const [drumSynthSettings, setDrumSynthSettings] = useState(() => ({
    ...DEFAULT_DRUM_SYNTH_SETTINGS,
    soundSelection: { ...DEFAULT_DRUM_SOUND_SELECTION },
  }));

  /**
   * Tone node refs filled by child synth components.
   *
   * Variables:
   * - drumSynthRef: Holds kick/snare/hihat/openhat Tone nodes and a ready flag.
   * - chordSynthRef: Holds the chord synth chain and a ready flag.
   */
  const drumSynthRef = useRef(null);
  const chordSynthRef = useRef(null);

  /**
   * Frozen playback snapshots.
   *
   * Variables:
   * - sequenceRef: Sequence captured at Play. Prevents live grid edits from changing playback mid-loop.
   * - chordsRef: Chord definitions captured at Play for the same reason.
   */
  const sequenceRef = useRef(asArray(sequence));
  const chordsRef = useRef(asArray(chords));

  /**
   * Live playback parameters.
   *
   * Variables:
   * - tracksRef: Latest track enabled flags and volumes. These remain live during playback.
   * - bpmRef: Latest tempo. Used for chord sustain calculation without recreating callbacks.
   * - chordVolumeRef: Latest chord volume. Applied immediately before triggering a chord.
   */
  const tracksRef = useRef(asObject(tracks));
  const bpmRef = useRef(bpm);
  const chordVolumeRef = useRef(chordVolume);

  const { Tone, isLoaded, ensureStarted, unlockAudioSync } = useToneEngine(
    bpm,
    masterVolume
  );


  useEffect(() => {
    tracksRef.current = asObject(tracks);
  }, [tracks]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    chordVolumeRef.current = chordVolume;
  }, [chordVolume]);

  useEffect(() => {
    if (!externalDrumSoundSelection) return;

    setDrumSynthSettings((previous) => ({
      ...previous,
      soundSelection: {
        ...previous.soundSelection,
        ...externalDrumSoundSelection,
      },
    }));
  }, [externalDrumSoundSelection]);

  /**
   * Updates local playing state and mirrors the value to the parent callback.
   *
   * Variables:
   * - value: Next playing state produced by transport start/stop.
   */
  const setPlaying = useCallback(
    (value) => {
      setIsPlaying(value);
      onPlayStateChange?.(value);
    },
    [onPlayStateChange]
  );

  /**
   * Replaces one drum lane sound while keeping all other drum settings intact.
   *
   * Variables:
   * - drumId: Drum lane id: kick, snare, hihat, or openhat.
   * - soundId: Selected sound preset/sample id for that lane.
   */
  const setDrumSoundSelection = useCallback((drumId, soundId) => {
    setDrumSynthSettings((previous) => ({
      ...previous,
      soundSelection: {
        ...(previous.soundSelection || DEFAULT_DRUM_SOUND_SELECTION),
        [drumId]: soundId,
      },
    }));
  }, []);

  /**
   * Captures sequence/chord data exactly when playback starts.
   */
  const prepareSequenceSnapshot = useCallback(() => {
    sequenceRef.current = asArray(sequence);
    chordsRef.current = asArray(chords);
  }, [sequence, chords]);

  const drumSoundSelection =
    drumSynthSettings.soundSelection || DEFAULT_DRUM_SOUND_SELECTION;

  /**
   * Triggers one chord through the shared chord synth.
   *
   * Variables:
   * - frequencies: Positive numeric note frequencies to play together.
   * - sustain: Duration in seconds.
   * - time: Tone.Transport scheduled time.
   */
  const playChord = useCallback((frequencies, sustain, time) => {
    const chain = chordSynthRef.current;
    if (!chain?.synth || chain.ready === false) return;
    if (!frequencies.length) return;

    chain.synth.volume.value = chordVolumeRef.current ?? 0;

    try {
      chain.synth.triggerAttackRelease(frequencies, sustain, time);
    } catch (error) {
      console.warn("Chord playback failed", error);
    }
  }, []);

  /**
   * Plays all drum events and at most one chord event for the requested step.
   *
   * Variables:
   * - step: Current sequencer step index from the transport loop.
   * - time: Tone.Transport scheduled time for sample-accurate triggering.
   */
  const playStep = useCallback(
    (step, time) => {
      const sequenceStep = asArray(sequenceRef.current)[step];
      const events = asArray(sequenceStep);
      const tracksSnapshot = asObject(tracksRef.current);
      const chordSnapshot = asArray(chordsRef.current);
      const drumTracks = asObject(tracksSnapshot.drums);
      const drums = asObject(drumSynthRef.current);

      if (drums.ready === false) return;

      const drumsEnabled = drumTracks.enabled === undefined || drumTracks.enabled;
      applyDrumVolumes(drums, drumTracks);

      for (const event of events) {
        if (!event || event.type !== "drum" || !drumsEnabled) continue;

        const track = asObject(drumTracks[event.drum]);
        if (track.enabled === false) continue;

        if (event.drum === "kick") triggerDrumNode(drums.kick, "C1", "8n", time);
        if (event.drum === "snare") triggerDrumNode(drums.snare, undefined, "8n", time);
        if (event.drum === "hihat") triggerDrumNode(drums.hihat, undefined, "8n", time);
        if (event.drum === "openhat") triggerDrumNode(drums.openhat, undefined, "4n", time);
      }

      const chordTracks = asArray(tracksSnapshot.chords);
      const chordGlobalTrack = asObject(chordTracks[0]);
      const chordsEnabled =
        chordGlobalTrack.enabled === undefined || chordGlobalTrack.enabled;

      if (!chordsEnabled) return;

      for (const event of events) {
        if (!event || event.type !== "chord" || !event.start) continue;

        const chord = chordSnapshot[event.chordIndex];
        if (!chord || chord.enabled === false) continue;

        const frequencies = getChordFrequencies(chord.notes);
        if (!frequencies.length) continue;

        const sustain = getSustainSeconds(event.sustain, bpmRef.current);
        playChord(frequencies, sustain, time);
        break; // Current behavior: one chord is allowed per step.
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

  /**
   * Starts playback after Tone.js is loaded and the browser audio context is unlocked.
   */
  const handleStart = useCallback(async () => {
    if (!isLoaded) return;

    const audioUnlocked = await ensureStarted();
    if (!audioUnlocked) return;

    prepareSequenceSnapshot();
    start();
  }, [isLoaded, ensureStarted, prepareSequenceSnapshot, start]);

  useImperativeHandle(
    ref,
    () => {
      /**
       * Creates a serializable snapshot of current drum lane volumes.
       */
      const createDrumVolumeSnapshot = () => {
        const drums = asObject(tracksRef.current?.drums);

        return DRUM_IDS.reduce((snapshot, drumId) => {
          snapshot[drumId] = drums[drumId]?.volume ?? 0;
          return snapshot;
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
          if (!isLoaded) return false;
          return unlockAudioSync?.() ?? false;
        },

        play: handleStart,
        stop,
        setDrumSound: setDrumSoundSelection,
      };
    },
    [
      bpm,
      masterVolume,
      chordVolume,
      chordSynthSettings,
      drumSoundSelection,
      handleStart,
      isLoaded,
      isPlaying,
      setDrumSoundSelection,
      stop,
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
