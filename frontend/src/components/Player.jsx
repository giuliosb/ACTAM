import { useRef, useState, useEffect } from "react";

// Tone.js is imported dynamically so the app loads faster
let Tone = null;

export default function Player({ sequence, chords, tracks, onStep }) {
  const STEPS = 16; // Total number of steps in the sequencer

  // ===== Playback & Audio Engine State =====
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(0);

  // Drum synth references stored across renders
  const kick = useRef(null);
  const snare = useRef(null);
  const hihat = useRef(null);

  // Transport scheduling handles
  const transportEvent = useRef(null);
  const stepCounter = useRef(0);

  // Each chord track has its own persistent synth+effects chain
  // chordChains.current[i] = { synth, filter, chorus, reverb, limiter }
  const chordChains = useRef([]);

  // ============================
  // Initialize Drum Synths
  // ============================
  const initDrums = () => {
    // Prevent multiple initializations
    if (kick.current) return;

    kick.current = new Tone.MembraneSynth().toDestination();
    snare.current = new Tone.NoiseSynth().toDestination();
    hihat.current = new Tone.MetalSynth().toDestination();
  };

  // ============================
  // Live Master Volume Updates
  // ============================
  useEffect(() => {
    if (Tone && Tone.Destination) {
      Tone.Destination.volume.value = masterVolume;
    }
  }, [masterVolume]);

  // ============================
  // Create / Sync Chord Synth Chains
  // ============================
  useEffect(() => {
    if (!Tone || !isPlaying) return;

    // Create missing chains
    for (let i = 0; i < chords.length; i++) {
      if (!chordChains.current[i]) {
        const filter = new Tone.Filter(1500, "lowpass");
        const chorus = new Tone.Chorus(4, 2.5).start();
        const reverb = new Tone.Reverb({ decay: 3, preDelay: 0.01 });
        const limiter = new Tone.Limiter(-1);

        // FM-style poly synth
        const synth = new Tone.PolySynth(Tone.FMSynth, {
          maxPolyphony: 8,
          volume: -8,
          detune: 0,
          envelope: {
            attack: 0.03,
            decay: 0.3,
            sustain: 0.5,
            release: 1.0,
          },
        });

        // Connect the chain → Destination
        synth.chain(filter, chorus, reverb, limiter, Tone.Destination);

        chordChains.current[i] = { synth, filter, chorus, reverb, limiter };
      }
    }

    // Remove chains for deleted chords
    if (chordChains.current.length > chords.length) {
      for (let i = chords.length; i < chordChains.current.length; i++) {
        const chain = chordChains.current[i];
        if (!chain) continue;

        chain.synth.dispose();
        chain.filter.dispose();
        chain.chorus.dispose();
        chain.reverb.dispose();
        chain.limiter.dispose();
      }
      chordChains.current.length = chords.length;
    }
  }, [chords.length, isPlaying]);

  // ============================
  // Cleanup on unmount
  // ============================
  useEffect(() => {
    return () => {
      chordChains.current.forEach((chain) => {
        if (!chain) return;
        chain.synth.dispose();
        chain.filter.dispose();
        chain.chorus.dispose();
        chain.reverb.dispose();
        chain.limiter.dispose();
      });
      chordChains.current = [];
    };
  }, []);

  // ============================
  // Play a Chord
  // ============================
  const playChord = (chordIndex, freqs, sustainSeconds, time) => {
    const chain = chordChains.current[chordIndex];
    if (!chain) return;

    // Track-level parameters for this chord
    const track =
      tracks.chords?.[chordIndex] ?? {
        volume: -8,
        cutoff: 1500,
        reverbMix: 0.3,
        chorusMix: 0.5,
        detune: 0,
      };

    // Live update all effect parameters
    chain.filter.frequency.value = track.cutoff;
    chain.chorus.wet.value = track.chorusMix;
    chain.reverb.wet.value = track.reverbMix;
    chain.synth.volume.value = track.volume;
    chain.synth.set({ detune: track.detune });

    // Play the chord
    chain.synth.triggerAttackRelease(freqs, sustainSeconds, time);
  };

  // ============================
  // Play a Single Step
  // ============================
  const playStep = (step, time, offsets = {}) => {
    const { kickOffset = 0, snareOffset = 0, hihatOffset = 0 } = offsets;
    const events = sequence[step] || [];

    // Update drum track parameters
    const drumTracks = tracks?.drums || {};
    if (kick.current) kick.current.volume.value = drumTracks.kick?.volume ?? 0;
    if (snare.current) snare.current.volume.value = drumTracks.snare?.volume ?? 0;
    if (hihat.current) hihat.current.volume.value = drumTracks.hihat?.volume ?? 0;

    // === Play Drum Events ===
    for (const ev of events) {
      if (ev.type !== "drum") continue;

      if (ev.drum === "kick")
        kick.current?.triggerAttackRelease("C1", "8n", time + kickOffset);

      if (ev.drum === "snare")
        snare.current?.triggerAttackRelease("8n", time + snareOffset);

      if (ev.drum === "hihat")
        hihat.current?.triggerAttackRelease("16n", time + hihatOffset);
    }

    // === Play Chord Event (only the start event triggers audio) ===
    for (const ev of events) {
      if (ev.type !== "chord" || !ev.start) continue;

      const chord = chords[ev.chordIndex];
      if (!chord) break;

      const freqs = chord.notes.map((n) => n.freq);
      const stepDuration = 60 / bpm / 4; // length of a 16th note
      const sustainSeconds = Math.max(0.03, ev.sustain * stepDuration);

      playChord(ev.chordIndex, freqs, sustainSeconds, time);
      break; // Only one chord per step
    }
  };

  // ============================
  // Start Playback
  // ============================
  const start = async () => {
    // Lazy-load Tone.js
    if (!Tone) {
      Tone = await import("tone");
      await Tone.start(); // Required for browsers to allow audio
    }

    initDrums();
    Tone.Transport.bpm.value = bpm;
    Tone.Destination.volume.value = masterVolume;

    stepCounter.current = 0;

    // Remove old scheduler if exists
    if (transportEvent.current) {
      Tone.Transport.clear(transportEvent.current);
    }

    // Schedule 16th-note loop
    transportEvent.current = Tone.Transport.scheduleRepeat((time) => {
      const step = stepCounter.current;

      // Compute swing values
      const sixteenth = 60 / bpm / 4;
      const kickSwing = tracks.drums?.kick?.swing ?? 0;
      const snareSwing = tracks.drums?.snare?.swing ?? 0;
      const hihatSwing = tracks.drums?.hihat?.swing ?? 0;

      const kickOffset = step % 2 === 1 ? sixteenth * kickSwing * 0.5 : 0;
      const snareOffset = step % 2 === 1 ? sixteenth * snareSwing * 0.5 : 0;
      const hihatOffset = step % 2 === 1 ? sixteenth * hihatSwing * 0.5 : 0;

      onStep(step);
      playStep(step, time, {
        kickOffset,
        snareOffset,
        hihatOffset,
      });

      // Move to next step
      stepCounter.current = (step + 1) % STEPS;
    }, "16n");

    Tone.Transport.start();
    setIsPlaying(true);
  };

  // ============================
  // Stop Playback
  // ============================
  const stop = () => {
    if (!Tone) return;

    Tone.Transport.stop();
    Tone.Transport.cancel();

    stepCounter.current = 0;
    onStep(-1);

    setIsPlaying(false);
  };

  // ============================
  // UI
  // ============================
  return (
    <div style={{ marginBottom: "20px" }}>
      {/* Play / Stop button */}
      <button onClick={isPlaying ? stop : start}>
        {isPlaying ? "Stop" : "Play"}
      </button>

      {/* BPM Controls */}
      <label style={{ marginLeft: "20px" }}>BPM:</label>
      <input
        type="number"
        min="40"
        max="240"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        disabled={isPlaying}
        style={{ width: "60px", margin: "0 10px" }}
      />
      <input
        type="range"
        min="40"
        max="240"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        disabled={isPlaying}
        style={{ width: "200px" }}
      />

      {/* Master Volume */}
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
    </div>
  );
}
