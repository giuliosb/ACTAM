import { useState, useEffect, useRef } from "react";
import Sequencer, {
  getSequencerSnapshot,
  buildSequenceFromSnapshot,
} from "./Sequencer.jsx";
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
  const fileInputRef = useRef(null);
  const playerRef = useRef(null);

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

  const handleSaveState = () => {
    const playerState =
      typeof playerRef.current?.getState === "function"
        ? playerRef.current.getState()
        : null;

    const sequencerSnapshot = getSequencerSnapshot({
      sequence,
      steps,
    });

    const stateToSave = {
      player: playerState,
      sequencer: sequencerSnapshot,
      accompaniment: {
        blocks,
        stepsPerBlock,
        steps,
        chords,
        tracks,
      },
      savedAt: new Date().toISOString(),
    };

    const blob = new Blob(
      [JSON.stringify(stateToSave, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "accompaniment-state.json";
    link.click();
    URL.revokeObjectURL(url);
  };
 
  const applyLoadedState = (input) => {
    if (!input || typeof input !== "object") return;

    const savedAccompaniment =
      input.accompaniment && typeof input.accompaniment === "object"
        ? input.accompaniment
        : {};

    const nextBlocks =
      Number.isFinite(savedAccompaniment.blocks) &&
      savedAccompaniment.blocks > 0
        ? savedAccompaniment.blocks
        : blocks;

    const nextStepsPerBlock =
      Number.isFinite(savedAccompaniment.stepsPerBlock) &&
      savedAccompaniment.stepsPerBlock > 0
        ? savedAccompaniment.stepsPerBlock
        : stepsPerBlock;

    const nextSteps =
      Number.isFinite(savedAccompaniment.steps) &&
      savedAccompaniment.steps > 0
        ? savedAccompaniment.steps
        : nextBlocks * nextStepsPerBlock;

    const normalizedSteps =
      Number.isFinite(nextSteps) && nextSteps > 0 ? nextSteps : steps;

    setBlocks(nextBlocks);
    setStepsPerBlock(nextStepsPerBlock);
    if (Number.isFinite(normalizedSteps) && normalizedSteps > 0) {
      setSteps(normalizedSteps);
    }

    if (Array.isArray(savedAccompaniment.chords)) {
      setChords(savedAccompaniment.chords);
    }
    if (
      savedAccompaniment.tracks &&
      typeof savedAccompaniment.tracks === "object"
    ) {
      setTracks(savedAccompaniment.tracks);
    }

    const reconstructedSequence = buildSequenceFromSnapshot(
      input.sequencer,
      normalizedSteps
    );
    setSequence(reconstructedSequence);

    if (playerRef.current?.setState) {
      playerRef.current.setState(input.player);
    }

    setCurrentStep(-1);
  };

  const handleLoadState = () => {
    fileInputRef.current?.click();
  };

  const handleStateFile = (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    const isJson =
      file.type === "application/json" ||
      file.name?.toLowerCase().endsWith(".json");

    if (!isJson) {
      console.warn("Please select a JSON file.");
      if (event.target) event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const input = JSON.parse(reader.result ?? "{}");
        applyLoadedState(input);
      } catch (err) {
        console.error("Failed to parse accompaniment state", err);
      }
    };
    reader.onerror = () => {
      console.error("Failed to read accompaniment state file", reader.error);
    };
    reader.onloadend = () => {
      if (event.target) event.target.value = "";
    };
    reader.readAsText(file);
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

      <div style={{ marginBottom: "12px" }}>
        <button onClick={handleSaveState} disabled={isPlaying} >Save current state</button>
        <button
          onClick={handleLoadState}
          disabled={isPlaying}
          style={{ marginLeft: "12px" }}
        >
          Load state
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleStateFile}
          style={{ display: "none" }}
        />
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
        ref={playerRef}
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
