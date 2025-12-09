import { useState, useEffect } from "react";
import Sequencer from "./Sequencer.jsx";
import Player from "./Player.jsx";
import { DEFAULT_STEPS, createEmptySequence } from "./musicConfig.js";

export default function Accompaniment() {
  // sequence & chords
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [blocks, setBlocks] = useState(2);
  const [stepsPerBlock, setStepsPerBlock] = useState(16);
  const [sequence, setSequence] = useState(() =>
    createEmptySequence(DEFAULT_STEPS)
  );
  const [chords, setChords] = useState([]);

  // tracks (drums + chords)
  const [tracks, setTracks] = useState({
    drums: {
      kick: { volume: 0 },
      snare: { volume: 0 },
      hihat: { volume: 0 },
      openhat: { volume: 0 },
    },
    chords: [],
  });

  const [currentStep, setCurrentStep] = useState(-1);
  const [openTrack, setOpenTrack] = useState(null);

  // nuovo stato globale di play
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setSequence((prevSequence) => {
      const safePrev = Array.isArray(prevSequence) ? prevSequence : [];
      if (safePrev.length === steps) return safePrev;
      if (safePrev.length > steps) {
        return safePrev.slice(0, steps);
      }
      return [
        ...safePrev,
        ...Array.from({ length: steps - safePrev.length }, () => []),
      ];
    });
  }, [steps]);

  useEffect(() => {
    setCurrentStep((prev) => (prev >= steps ? -1 : prev));
  }, [steps]);

  const removeChord = (index) => {
    // 1) aggiorna chords
    const newChords = (Array.isArray(chords) ? chords : []).filter(
      (_, i) => i !== index
    );
    setChords(newChords);

    // 2) aggiorna tracks.chords in modo difensivo
    setTracks((prev) => {
      const safePrev = prev || {};
      const prevChords = safePrev.chords || [];
      return {
        ...safePrev,
        chords: prevChords.filter((_, i) => i !== index),
      };
    });

    // 3) pulisci la sequence
    const prevSeq = Array.isArray(sequence) ? sequence : [];
    let newSeq = prevSeq.map((step) =>
      (Array.isArray(step) ? step : []).filter(
        (ev) => ev.type !== "chord" || ev.chordIndex !== index
      )
    );

    // riallinea gli indici degli accordi successivi
    newSeq = newSeq.map((step) =>
      step.map((ev) =>
        ev.type === "chord" && ev.chordIndex > index
          ? { ...ev, chordIndex: ev.chordIndex - 1 }
          : ev
      )
    );

    setSequence(newSeq);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Music Sequencer</h1>
      <div style={{ marginBottom: "12px" }}>
        <label style={{ marginRight: "10px" }}>Number of blocks:</label>
        <select
          value={blocks}
          onChange={(e) => {
              setBlocks(Number(e.target.value));
              setSteps(Number(e.target.value) * stepsPerBlock);
          }}
          disabled={isPlaying}
          style={{ width: "130px" }}
        >
          <option value={'1'}>1</option>
          <option value={'2'}>2</option>
          <option value={'3'}>3</option>
          <option value={'4'}>4</option>
        </select>

        <label style={{ marginRight: "10px" }}>Metre:</label>
        <select
          value={stepsPerBlock}
          onChange={(e) => {
            setStepsPerBlock(Number(e.target.value));
            setSteps(blocks * Number(e.target.value));
          }}
          disabled={isPlaying}
          style={{ width: "130px" }}
        >
          <option value={16}>4/4</option>
          <option value={12}>3/4</option>
          <option value={20}>5/4</option>
          <option value={14}>7/8</option>
          <option value={18}>9/8</option>
          <option value={22}>11/8</option>
        </select>
      </div>

      <Sequencer
        sequence={sequence}
        onSequenceChange={setSequence}
        chords={chords}
        onChordsChange={setChords}
        tracks={tracks}
        onTracksChange={setTracks}
        currentStep={currentStep}
        openTrack={openTrack}
        setOpenTrack={setOpenTrack}
        onRemoveChord={removeChord}
        isPlaying={isPlaying}          // <-- bloccaremo l’editing qui dentro blablablalba
        steps={steps}
        stepsPerBlock={stepsPerBlock}
      />

      <Player
        sequence={sequence}
        tracks={tracks}
        chords={chords}
        onStep={setCurrentStep}
        onTracksChange={setTracks}
        onPlayStateChange={setIsPlaying}  // <-- Player notifica play/stop
        steps={steps}
      />
    </div>
  );
}
