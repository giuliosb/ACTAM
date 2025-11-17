// Updated Player.jsx with live master volume updates
import { useRef, useState, useEffect } from "react";

let Tone = null;

export default function Player({ sequence, chords, tracks, onStep }) {
  const STEPS = 16;

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(0);

  const kick = useRef(null);
  const snare = useRef(null);
  const hihat = useRef(null);

  const transportEvent = useRef(null);
  const stepCounter = useRef(0);

  // ---------------- INIT DRUM SYNTHS ----------------
  const initDrums = () => {
    if (kick.current) return;

    kick.current = new Tone.MembraneSynth().toDestination();
    snare.current = new Tone.NoiseSynth().toDestination();
    hihat.current = new Tone.MetalSynth().toDestination();
  };

  // ---------------- LIVE MASTER VOLUME UPDATE ----------------
  useEffect(() => {
    if (Tone && Tone.Destination) {
      Tone.Destination.volume.value = masterVolume;
    }
  }, [masterVolume]);

  // ---------------- PLAY CHORD ----------------
  const playChord = (chordIndex, freqs, sustainSeconds, time) => {
    const track = tracks.chords?.[chordIndex] ?? {
      volume: -8,
      cutoff: 1500,
      reverbMix: 0.3,
      chorusMix: 0.5,
      detune: 0,
    };

    const filter = new Tone.Filter(track.cutoff, "lowpass");
    const chorus = new Tone.Chorus(4, 2.5, track.chorusMix).start();
    const reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01 });
    reverb.wet.value = track.reverbMix;
    const limiter = new Tone.Limiter(-1);

    const synth = new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 8,
      volume: track.volume,
      detune: track.detune,
      envelope: {
        attack: 0.03,
        decay: 0.3,
        sustain: 0.5,
        release: 1.0,
      },
    })
      .chain(filter, chorus, reverb, limiter)
      .toDestination();

    synth.triggerAttackRelease(freqs, sustainSeconds, time);

    setTimeout(() => {
      synth.dispose();
      filter.dispose();
      chorus.dispose();
      reverb.dispose();
      limiter.dispose();
    }, (sustainSeconds + 0.2) * 1000);
  };

  // ---------------- PLAY STEP ----------------
  const playStep = (step, time, offsets = {}) => {
    const { kickOffset = 0, snareOffset = 0, hihatOffset = 0 } = offsets;

    const events = sequence[step] || [];

    const drumTracks = tracks?.drums || {};
    if (kick.current) kick.current.volume.value = drumTracks.kick?.volume ?? 0;
    if (snare.current) snare.current.volume.value = drumTracks.snare?.volume ?? 0;
    if (hihat.current) hihat.current.volume.value = drumTracks.hihat?.volume ?? 0;

    for (const ev of events) {
      if (ev.type !== "drum") continue;

      if (ev.drum === "kick")
        kick.current?.triggerAttackRelease("C1", "8n", time + kickOffset);

      if (ev.drum === "snare")
        snare.current?.triggerAttackRelease("8n", time + snareOffset);

      if (ev.drum === "hihat")
        hihat.current?.triggerAttackRelease("16n", time + hihatOffset);
    }

    for (const ev of events) {
      if (ev.type !== "chord" || !ev.start) continue;

      const chord = chords[ev.chordIndex];
      if (!chord) break;

      const freqs = chord.notes.map((n) => n.freq);
      const stepDuration = 60 / bpm / 4;
      const sustainSeconds = Math.max(0.03, ev.sustain * stepDuration);

      playChord(ev.chordIndex, freqs, sustainSeconds, time);
      break;
    }
  };

  // ---------------- START ----------------
  const start = async () => {
    if (!Tone) {
      Tone = await import("tone");
      await Tone.start();
    }

    initDrums();
    Tone.Transport.bpm.value = bpm;
    Tone.Destination.volume.value = masterVolume; // initial set

    stepCounter.current = 0;

    if (transportEvent.current) {
      Tone.Transport.clear(transportEvent.current);
    }

    transportEvent.current = Tone.Transport.scheduleRepeat((time) => {
      const step = stepCounter.current;

      const kickSwing  = tracks.drums?.kick?.swing  ?? 0;
      const snareSwing = tracks.drums?.snare?.swing ?? 0;
      const hihatSwing = tracks.drums?.hihat?.swing ?? 0;

      const baseOffset = 60 / bpm / 8;

      const kickOffset  = step % 2 === 1 ? baseOffset * kickSwing  : 0;
      const snareOffset = step % 2 === 1 ? baseOffset * snareSwing : 0;
      const hihatOffset = step % 2 === 1 ? baseOffset * hihatSwing : 0;

      onStep(step);

      playStep(step, time, {
        kickOffset,
        snareOffset,
        hihatOffset,
      });

      stepCounter.current = (step + 1) % STEPS;
    }, "16n");

    Tone.Transport.start();
    setIsPlaying(true);
  };

  const stop = () => {
    if (!Tone) return;

    Tone.Transport.stop();
    Tone.Transport.cancel();

    stepCounter.current = 0;
    onStep(-1);
    setIsPlaying(false);
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      <button onClick={isPlaying ? stop : start}>
        {isPlaying ? "Stop" : "Play"}
      </button>

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
