import { useState, useEffect, useRef } from "react";
import "./Accompaniment.css";
import Slider from "../general_components/Slider.jsx";
import SliderDigital from "../general_components/SliderDigital.jsx";
import Knob from "../general_components/Knob.jsx";
import Sequencer, {
  getSequencerSnapshot,
  buildSequenceFromSnapshot,
} from "./Sequencer.jsx";

import Player, {
  CHORD_INSTRUMENTS,
  DRUM_IDS,
  DRUM_SOUND_OPTIONS,
  DEFAULT_DRUM_SOUND_SELECTION,
} from "./Player.jsx";
import {
  DEFAULT_STEPS,
  createEmptySequence,
  NOTES,
  TRIADS,
  EXTENSIONS,
  DEFAULT_CHORD_TRACK,
} from "./musicConfig.js";
import { DEFAULT_CHORD_SYNTH_SETTINGS } from "./ChordSynth.jsx";
import { DEFAULT_DRUM_SYNTH_SETTINGS } from "./Drumshynt.jsx";
import ChordGenerator from "./ChordGenerator.jsx";
import ArrowSelect from "../general_components/ArrowSelect.jsx";

const TIME_SIGNATURES = [
  { label: "4/4", steps: 16 },
  { label: "3/4", steps: 12 },
  { label: "5/4", steps: 20 },
  { label: "7/8", steps: 14 },
  { label: "9/8", steps: 18 },
  { label: "11/8", steps: 22 },
];



export default function Accompaniment({ currentCard }) {
  

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
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(-1);
  const [chordVolume, setChordVolume] = useState(0);
  const [chordSynthSettings, setChordSynthSettings] = useState(() => ({
    ...DEFAULT_CHORD_SYNTH_SETTINGS,
  }));
  const [drumSoundSelection, setDrumSoundSelection] = useState(() => ({
    ...DEFAULT_DRUM_SOUND_SELECTION,
  }));

  //Abort on card change
  const isGeneratedCard = useRef(false);
  useEffect(() => {
    isGeneratedCard.current = currentCard === "generated";
    if (isGeneratedCard.current ) setIsPlaying(false);
     const player = playerRef.current;
    if (isPlaying) {
      player.stop && player.stop();}
  }, [currentCard, setIsPlaying]);
 
    

  const [a4Frequency, setA4Frequency] = useState(440);
  const [rootNote, setRootNote] = useState("C");
  const [octave, setOctave] = useState(3);
  const [triad, setTriad] = useState("Major");
  const [extension, setExtension] = useState("");

  const noteFrequency = (note, octaveValue) => {
    const n = NOTES.indexOf(note) + (octaveValue - 4) * 12 - 9;
    return a4Frequency * Math.pow(2, n / 12);
  };


  function map0to100ToDb(value) {
  const inMin = 0;
  const inMax = 100;
  const outMin = -30;
  const outMax = 6;

  const clamped = Math.max(inMin, Math.min(inMax, value));

  return outMin + (clamped - inMin) * (outMax - outMin) / (inMax - inMin);
}

function mapDbTo0to100(db) {
  const inMin = -30;
  const inMax = 6;
  const outMin = 0;
  const outMax = 100;

  const clamped = Math.max(inMin, Math.min(inMax, db));

  return (clamped - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}


  const buildChordNotes = () => {
    const rootIndex = NOTES.indexOf(rootNote);
    const baseTriad = TRIADS[triad];
    const chordIntervals =
      extension && EXTENSIONS[extension] !== null
        ? [...baseTriad, EXTENSIONS[extension]]
        : baseTriad;

    return chordIntervals.map((interval) => {
      const noteIndex = rootIndex + interval;
      const noteName = NOTES[noteIndex % 12];
      const noteOct = octave + Math.floor(noteIndex / 12);
      return {
        note: noteName,
        octave: noteOct,
        freq: noteFrequency(noteName, noteOct),
      };
    });
  };

  const isDuplicateChord = (root, triadName, extensionName) => {
    const list = Array.isArray(chords) ? chords : [];
    return list.some(
      (ch) =>
        ch &&
        ch.root === root &&
        ch.triad === triadName &&
        (ch.extension || "") === (extensionName || "")
    );
  };

  const addChord = () => {
    if (isPlaying) return;
    if (isDuplicateChord(rootNote, triad, extension)) return;

    const notes = buildChordNotes();

    setChords((prev) => [
      ...(Array.isArray(prev) ? prev : []),
      { root: rootNote, triad, extension, notes },
    ]);

    setTracks((prev) => {
      const safePrev = prev || {};
      const prevChordsTracks = safePrev.chords || [];
      if (prevChordsTracks.length === 0) {
        return {
          ...safePrev,
          chords: [{ ...DEFAULT_CHORD_TRACK }],
        };
      }
      return safePrev;
    });
  };

  const handleDrumVolumeChange = (drumId, value) => {
    const vol = Number(value);
    setTracks((prev) => {
      const safePrev = prev || {};
      const prevDrums = safePrev.drums || {};
      const prevDrumTrack = prevDrums[drumId] || {};

      return {
        ...safePrev,
        drums: {
          ...prevDrums,
          [drumId]: {
            ...prevDrumTrack,
            volume: vol,
          },
        },
      };
    });
  };

  const handleDrumSoundChange = (drumId, soundId) => {
    setDrumSoundSelection((prev) => ({
      ...prev,
      [drumId]: soundId,
    }));

    playerRef.current?.setDrumSound?.(drumId, soundId);
  };

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
    const drumsSnapshot = DRUM_IDS.reduce((acc, drumId) => {
      const drumTrack = (tracks?.drums || {})[drumId] || {};
      acc[drumId] = drumTrack.volume ?? 0;
      return acc;
    }, {});

    const fallbackPlayerState = {
      bpm,
      masterVolume,
      chordVolume,
      chordSynthSettings,
      chordInstrument: chordSynthSettings.instrument,
      chordInstruments: CHORD_INSTRUMENTS,
      drumVolumes: drumsSnapshot,
      isPlaying,
    };

    const playerState =
      typeof playerRef.current?.getState === "function"
        ? playerRef.current.getState()
        : fallbackPlayerState;

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

    const savedPlayer =
      input.player && typeof input.player === "object" ? input.player : {};

    if (Number.isFinite(savedPlayer.bpm)) {
      setBpm(savedPlayer.bpm);
    }
    if (Number.isFinite(savedPlayer.masterVolume)) {
      setMasterVolume(savedPlayer.masterVolume);
    }
    if (Number.isFinite(savedPlayer.chordVolume)) {
      setChordVolume(savedPlayer.chordVolume);
    }
    if (savedPlayer.chordSynthSettings && typeof savedPlayer.chordSynthSettings === "object") {
      setChordSynthSettings((prev) => ({
        ...prev,
        ...savedPlayer.chordSynthSettings,
      }));
    } else if (savedPlayer.chordInstrument) {
      setChordSynthSettings((prev) => ({
        ...prev,
        instrument: savedPlayer.chordInstrument,
      }));
    }
    if (savedPlayer.drumVolumes && typeof savedPlayer.drumVolumes === "object") {
      setTracks((prev) => {
        const safePrev = prev || {};
        const prevDrums = safePrev.drums || {};
        const updatedDrums = { ...prevDrums };
        DRUM_IDS.forEach((drumId) => {
          const nextVol = savedPlayer.drumVolumes[drumId];
          if (Number.isFinite(nextVol)) {
            const prevDrum = updatedDrums[drumId] || {};
            updatedDrums[drumId] = {
              ...prevDrum,
              volume: nextVol,
            };
          }
        });
        return {
          ...safePrev,
          drums: updatedDrums,
        };
      });
    }
    if (savedPlayer.drumSounds && typeof savedPlayer.drumSounds === "object") {
      setDrumSoundSelection((prev) => ({
        ...prev,
        ...savedPlayer.drumSounds,
      }));
      Object.entries(savedPlayer.drumSounds).forEach(([drumId, soundId]) => {
        playerRef.current?.setDrumSound?.(drumId, soundId);
      });
    }

    setCurrentStep(-1);
    setIsPlaying(false);
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

  const handlePlayToggle = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.stop && player.stop();
    } else {
      player.play && player.play();
    }
  };

  const drumTracks = tracks?.drums || {};

  return (
    <div style={{ padding: "20px" }}>
      <Player
        ref={playerRef}
        sequence={sequence}
        tracks={tracks}
        chords={chords}
        onStep={setCurrentStep}
        onTracksChange={setTracks}
        onPlayStateChange={setIsPlaying}  // <-- Player notifica play/stop
        steps={steps}
        bpm={bpm}
        masterVolume={masterVolume}
        chordVolume={chordVolume}
        chordSynthSettings={chordSynthSettings}
        drumSoundSelection={drumSoundSelection}
      />
      <div className="analog-panel">
        <h3 style={{ marginBottom: "16px" }}>VOLUMES</h3>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "32px",
          }}
        >
              <div style={{ textAlign: "center" }}>
                <Knob
                   min={-30}
                   max={6}
                   step={1}
                  value={mapDbTo0to100(masterVolume)}
                  onChange={(knobValue) => {
                    setMasterVolume(Math.round(map0to100ToDb(knobValue)));
                    console.log(Math.round(map0to100ToDb(knobValue)));
                  }}
                />
                  
                <div className="fontt" style={{ marginTop: "8px" }}>MASTER</div>
              </div>
                  <div style={{ textAlign: "end" }}>
                  <Slider
                    min={-30}
                    max={6}
                    step={1}
                    value={chordVolume}
                    onChange={(value) => {
                      setChordVolume(value);
                    }}
                  />

                  <div style={{ marginTop: "8px" }}>CHORDS</div>
                </div>
                {DRUM_IDS.map((drumId) => {
                  const vol = drumTracks[drumId]?.volume ?? 0;

                  return (
                    <div
                      key={drumId}
                      style={{ textAlign: "end" }}
                    >
                      
                      <Slider
                        min={-30}
                        max={6}
                        step={1}
                        value={vol}
                        onChange={(value) =>
                          handleDrumVolumeChange(drumId, value)
                        }
                      />
                      <div
                        style={{
                          marginTop: "8px",
                          paddingRight: "10px",
                          textTransform: "capitalize",
                        }}
                      >
                        {drumId.toUpperCase()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>





{/*  <h4>BPM</h4>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <input
              type="number"
              min="40"
              max="240"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              style={{ width: "70px" }}
            />
            <input
              type="range"
              min="40"
              max="240"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </div> */}
      
     

     {/*   DIGITAL PANEL    */}
     <figure>
          <div className="outerBevel">
            <div className="flatSurface">
              <div className="innerBevel">
                <div className="inside noise pixelFont " style={{ padding: "2rem"  }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      gap: "32px",
                      flexWrap: "wrap",
                      minHeight: "320px",
                    }}
                  >
                    <div className='drum-sound-panel'>
                      <h2>sounds</h2>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {DRUM_IDS.map((drumId) => {
                          const options = DRUM_SOUND_OPTIONS[drumId] || [];
                          const selected =
                            drumSoundSelection[drumId] ??
                            DEFAULT_DRUM_SOUND_SELECTION[drumId] ??
                            options[0]?.id;
                          return (
                            <div
                              key={drumId}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <label
                                htmlFor={`drum-sound-${drumId}`}
                                style={{ width: "120px" }}
                              >
                                {drumId}:
                              </label>
                              <ArrowSelect
                                id={`drum-sound-${drumId}`}
                                options={options}
                                value={selected}
                                onChange={(newId) => handleDrumSoundChange(drumId, newId)}
                                getValue={(o) => o.id}
                                getLabel={(o) => o.label}
                              />
                            </div>
                          );
                        })}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <label style={{ width: "120px" }}>chords:</label>
                          <ArrowSelect
                            options={CHORD_INSTRUMENTS}
                            value={chordSynthSettings.instrument}
                            onChange={(newInstrumentId) =>
                              setChordSynthSettings((prev) => ({
                                ...prev,
                                instrument: newInstrumentId,
                              }))
                            }
                            getValue={(o) => o.id}
                            getLabel={(o) => o.label}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "140px",
                        alignSelf: "end",
                        marginBottom: "20px",
                      }}
                    >
                      <div style={{
                          padding: "3px",
                        }}>
                      <SliderDigital
                        value={bpm}
                        min={40}
                        max={240}
                        step={1}
                        onChange={(value) => setBpm(Math.round(value))}
                      />
                      </div>
                      
                      <div
                        style={{
                          marginTop: "20px",
                          width: "120px",
                          padding: "3px",
                        }}
                      >
                        BPM: {bpm}
                      </div>
                    </div>
                   {/* STATE SAVE/LOAD */}
                    <div>
                      <div
                        onClick={handleSaveState}
                        disabled={isPlaying}
                        className="save-load-button"
                      >
                        SAVE
                      </div>
                    
                      <div
                        onClick={handleLoadState}
                        disabled={isPlaying}
                        className="save-load-button"
                      >
                        LOAD
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleStateFile}
                        style={{ display: "none" }}
                      />
                      
                    </div>

                  </div>

                  {/* GRID SETTINGS + START STOP*/}
                   <div style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",   // ← key
                      gap: "16px",            // spacing instead of margins
                      marginBottom: "12px",
                    }}>

                    {/* START STOP */}
                     <button
                      disabled={!playerRef.current}
                      className="generator-panel start-button"
                      onClick={handlePlayToggle}>
                      {isPlaying ? (
                        <svg
                          className="pixel-icon icon-pause"
                          viewBox="0 0 52 64"
                          role="img"
                          aria-hidden="true"
                        >
                          <rect x="6" y="14" width="10" height="36" />
                          <rect x="30" y="14" width="10" height="36" />
                        </svg>
                      ) : (
                        <svg
                          className="pixel-icon icon-play"
                          viewBox="0 0 72 64"
                          role="img"
                          aria-hidden="true"
                        >
                          <path d="M12 12 H42 L62 32 L42 52 H12 Z" />
                        </svg>
                      )}
                    </button>

                    <label style={{ marginRight: "10px" }}>Number of blocks:</label>
                    <select
                      className="pixel-select"
                      value={blocks}
                      onChange={(e) => {
                          setBlocks(Number(e.target.value));
                          setSteps(Number(e.target.value) * stepsPerBlock);
                      }}
                      disabled={isPlaying}
                    >
                      <option value={'1'}>1</option>
                      <option value={'2'}>2</option>
                      <option value={'3'}>3</option>
                      <option value={'4'}>4</option>
                    </select>

                    <label style={{ marginRight: "10px" }}>Metre:</label>
                    <select
                      className="pixel-select"
                      value={stepsPerBlock}
                      onChange={(e) => {
                        setStepsPerBlock(Number(e.target.value));
                        setSteps(blocks * Number(e.target.value));
                      }}
                      disabled={isPlaying}
                    >
                      <option value={16}>4/4</option>
                      <option value={12}>3/4</option>
                      <option value={20}>5/4</option>
                      <option value={14}>7/8</option>
                      <option value={18}>9/8</option>
                      <option value={22}>11/8</option>
                    </select>
                

                  </div>
                   
                    <ChordGenerator
                    a4Frequency={a4Frequency}
                    setA4Frequency={setA4Frequency}
                    rootNote={rootNote}
                    setRootNote={setRootNote}
                    triad={triad}
                    setTriad={setTriad}
                    extension={extension}
                    setExtension={setExtension}
                    octave={octave}
                    setOctave={setOctave}
                    addChord={addChord}
                    isDuplicateChord={isDuplicateChord}
                    isPlaying={isPlaying}
                    />


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
                </div>
              </div>
            </div>
            </div>
        </figure>    

    </div>
  );
}
