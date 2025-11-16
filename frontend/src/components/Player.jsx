import { useRef, useState } from "react";

let Tone = null;

export default function Player({ sequence, chords, tracks, onStep }) {
  const STEPS = 16;

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(0);
  const [swing, setSwing] = useState(0);

  const kick = useRef(null);
  const snare = useRef(null);
  const hihat = useRef(null);

  const transportEvent = useRef(null);
  const stepCounter = useRef(0);

  const initSynths = () => {
    if (kick.current) return;

    kick.current = new Tone.MembraneSynth().toDestination();
    snare.current = new Tone.NoiseSynth().toDestination();
    hihat.current = new Tone.MetalSynth().toDestination();
  };

  // 🎯 CREA UNA CHAIN NUOVA PER OGNI ACCORDO (ZERO ERRORI)
  const buildChordSynth = (track) => {
    const filter = new Tone.Filter(track.cutoff, "lowpass");
    const chorus = new Tone.Chorus(4, 2.5, track.chorusMix).start();
    const reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01 });
    reverb.wet.value = track.reverbMix;
    const limiter = new Tone.Limiter(-1);

    const synth = new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 24,
      volume: track.volume,
      detune: track.detune,
      envelope: {
        attack: 0.03,
        decay: 0.3,
        sustain: 0.5,
        release: 1.0,
      },
    }).chain(filter, chorus, reverb, limiter)
      .toDestination();

    return synth;
  };

  const playStep = (step, time) => {
    const events = sequence[step] || [];

    // apply drum volumes per-row
    const drumTracks = tracks?.drums || {};
    if (kick.current) kick.current.volume.value = drumTracks.kick?.volume ?? 0;
    if (snare.current) snare.current.volume.value = drumTracks.snare?.volume ?? 0;
    if (hihat.current) hihat.current.volume.value = drumTracks.hihat?.volume ?? 0;

    // ----------------- DRUM TRIGGERS -----------------
    events.forEach((ev) => {
      if (ev.type !== "drum") return;

      if (ev.drum === "kick")
        kick.current?.triggerAttackRelease("C1", "8n", time);

      if (ev.drum === "snare")
        snare.current?.triggerAttackRelease("8n", time);

      if (ev.drum === "hihat")
        hihat.current?.triggerAttackRelease("16n", time);
    });

    // ----------------- CHORD TRIGGER -----------------
    for (const ev of events) {
      if (ev.type !== "chord" || !ev.start) continue;

      const chord = chords[ev.chordIndex];
      if (!chord) break;

      const freqs = chord.notes.map((n) => n.freq);

      const track =
        tracks.chords?.[ev.chordIndex] || {
          volume: -8,
          cutoff: 1500,
          reverbMix: 0.3,
          chorusMix: 0.5,
          detune: 0,
        };

      // durata dello step in secondi
      const stepDuration = 60 / bpm / 4;
      const sustainSeconds = Math.max(0.03, ev.sustain * stepDuration);

      // 🎛 CREA IL SYNTH AD OGNI ACCORDO
      const synth = buildChordSynth(track);
      synth.triggerAttackRelease(freqs, sustainSeconds, time);

      break;
    }
  };

  const start = async () => {
    if (!Tone) {
      Tone = await import("tone");
      await Tone.start();
    }

    initSynths();

    Tone.Transport.bpm.value = bpm;
    Tone.Transport.swing = swing;
    Tone.Transport.swingSubdivision = "16n";
    Tone.Destination.volume.value = masterVolume;

    stepCounter.current = 0;

    if (transportEvent.current) {
      Tone.Transport.clear(transportEvent.current);
    }

    transportEvent.current = Tone.Transport.scheduleRepeat((time) => {
      const step = stepCounter.current;

      onStep(step);
      playStep(step, time);

      stepCounter.current = (stepCounter.current + 1) % STEPS;
    }, "16n");

    Tone.Transport.start();
    setIsPlaying(true);
  };

  const stop = () => {
    if (!Tone) return;

    Tone.Transport.stop();
    Tone.Transport.cancel();

    onStep(-1);
    stepCounter.current = 0;
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

      {/* MASTER VOLUME */}
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
        <span>{masterVolume} dB</span>
      </div>

      {/* SWING */}
      <div style={{ marginTop: "10px" }}>
        <label>Swing: </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={swing}
          onChange={(e) => setSwing(Number(e.target.value))}
          style={{ width: "200px" }}
        />
        <span>{Math.round(swing * 100)}%</span>
      </div>
    </div>
  );
}
