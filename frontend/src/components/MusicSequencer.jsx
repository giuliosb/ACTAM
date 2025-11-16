import { useState } from "react";

export default function MusicSequencer({
  sequence,
  onSequenceChange,
  chords,
  onChordsChange,
  tracks,
  onTracksChange,
  currentStep,
}) {
  const STEPS = 16;

  // 🔧 Track editor modal
  const [openTrack, setOpenTrack] = useState(null);
  // openTrack = { type: "drum", id: "kick" }
  // openTrack = { type: "chord", index: 2 }

  // ------------------------------------------------------------
  // TOGGLE CELL (drum or chord)
  // ------------------------------------------------------------
  const handleToggle = (step, event) => {
    const newSeq = [...sequence];
    const stepEvents = [...newSeq[step]];

    // DRUM
    if (event.type === "drum") {
      const existing = stepEvents.find(
        (ev) => ev.type === "drum" && ev.drum === event.drum
      );

      if (existing) {
        newSeq[step] = stepEvents.filter(
          (ev) => !(ev.type === "drum" && ev.drum === event.drum)
        );
      } else {
        stepEvents.push({ type: "drum", drum: event.drum });
        newSeq[step] = stepEvents;
      }
    }

    // CHORD
    else if (event.type === "chord") {
      const existing = stepEvents.find(
        (ev) =>
          ev.type === "chord" && ev.chordIndex === event.chordIndex
      );

      if (existing) {
        newSeq[step] = stepEvents.filter(
          (ev) =>
            !(ev.type === "chord" && ev.chordIndex === event.chordIndex)
        );
      } else {
        stepEvents.push({
          type: "chord",
          chordIndex: event.chordIndex,
          start: true,
          sustain: 1,
        });
        newSeq[step] = stepEvents;
      }
    }

    onSequenceChange(newSeq);
  };

  // ------------------------------------------------------------
  // ADD CHORD ROW
  // ------------------------------------------------------------
  const addChordRow = () => {
    const newChord = {
      root: "C",
      triad: "major",
      extension: "",
      notes: [
        { name: "C4", freq: 261.63 },
        { name: "E4", freq: 329.63 },
        { name: "G4", freq: 392.0 },
      ],
    };

    const newChords = [...chords, newChord];

    onChordsChange(newChords);

    onTracksChange((prev) => ({
      ...prev,
      chords: [
        ...prev.chords,
        {
          volume: -8,
          cutoff: 1500,
          reverbMix: 0.3,
          chorusMix: 0.5,
          detune: 0,
        },
      ],
    }));
  };

  // ------------------------------------------------------------
  // CLEAR CHORD ROWS
  // ------------------------------------------------------------
  const clearChordRows = () => {
    onChordsChange([]);

    onTracksChange((prev) => ({
      ...prev,
      chords: [],
    }));

    const newSeq = sequence.map(() =>
      []
    );
    onSequenceChange(newSeq);
  };

  // ------------------------------------------------------------
  // UTILITY
  // ------------------------------------------------------------
  const isActive = (step, event) => {
    return sequence[step]?.some((ev) => {
      if (event.type === "drum") {
        return ev.type === "drum" && ev.drum === event.drum;
      }
      if (event.type === "chord") {
        return ev.type === "chord" && ev.chordIndex === event.chordIndex;
      }
      return false;
    });
  };

  // Styles
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `100px repeat(${STEPS}, 40px)`,
    gap: "2px",
    alignItems: "center",
  };

  const cellStyle = (active, highlighted) => ({
    width: "40px",
    height: "40px",
    background: highlighted
      ? "#ffd27f"
      : active
      ? "#4caf50"
      : "#ddd",
    borderRadius: "4px",
    cursor: "pointer",
    border: "1px solid #aaa",
  });

  const nameCellStyle = {
    padding: "6px",
    background: "#222",
    color: "white",
    cursor: "pointer",
    borderRadius: "4px",
    textAlign: "center",
  };

  // ------------------------------------------------------------
  // TRACK EDITOR POPUP COMPONENT
  // ------------------------------------------------------------
  const TrackEditor = () => {
    if (!openTrack) return null;

    const close = () => setOpenTrack(null);

    return (
      <div
        className="track-editor-overlay"
        onClick={close}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backdropFilter: "blur(2px)",
          zIndex: 999,
        }}
      >
        <div
          className="track-editor"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            minWidth: "300px",
            boxShadow: "0 0 20px rgba(0,0,0,0.3)",
            position: "relative",
          }}
        >
          <button
            onClick={close}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "#ccc",
              border: "none",
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            X
          </button>

          {/* ---------- DRUM TRACK ---------- */}
          {openTrack.type === "drum" && (
            <>
              <h3>{openTrack.id.toUpperCase()} Settings</h3>

              <label>Volume</label>
              <input
                type="range"
                min="-30"
                max="6"
                value={tracks.drums[openTrack.id].volume}
                onChange={(e) =>
                  onTracksChange((prev) => ({
                    ...prev,
                    drums: {
                      ...prev.drums,
                      [openTrack.id]: {
                        ...prev.drums[openTrack.id],
                        volume: Number(e.target.value),
                      },
                    },
                  }))
                }
                style={{ width: "100%" }}
              />
            </>
          )}

          {/* ---------- CHORD TRACK ---------- */}
          {openTrack.type === "chord" && (
            <>
              <h3>Chord Row {openTrack.index + 1} Settings</h3>

              <label>Volume</label>
              <input
                type="range"
                min="-30"
                max="6"
                value={tracks.chords[openTrack.index].volume}
                onChange={(e) =>
                  onTracksChange((prev) => {
                    const ch = [...prev.chords];
                    ch[openTrack.index].volume = Number(e.target.value);
                    return { ...prev, chords: ch };
                  })
                }
                style={{ width: "100%" }}
              />

              <label>Filter Cutoff</label>
              <input
                type="range"
                min="300"
                max="8000"
                value={tracks.chords[openTrack.index].cutoff}
                onChange={(e) =>
                  onTracksChange((prev) => {
                    const ch = [...prev.chords];
                    ch[openTrack.index].cutoff = Number(e.target.value);
                    return { ...prev, chords: ch };
                  })
                }
                style={{ width: "100%" }}
              />

              <label>Reverb Mix</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={tracks.chords[openTrack.index].reverbMix}
                onChange={(e) =>
                  onTracksChange((prev) => {
                    const ch = [...prev.chords];
                    ch[openTrack.index].reverbMix = Number(e.target.value);
                    return { ...prev, chords: ch };
                  })
                }
                style={{ width: "100%" }}
              />

              <label>Chorus Mix</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={tracks.chords[openTrack.index].chorusMix}
                onChange={(e) =>
                  onTracksChange((prev) => {
                    const ch = [...prev.chords];
                    ch[openTrack.index].chorusMix = Number(e.target.value);
                    return { ...prev, chords: ch };
                  })
                }
                style={{ width: "100%" }}
              />

              <label>Detune</label>
              <input
                type="range"
                min="-50"
                max="50"
                value={tracks.chords[openTrack.index].detune}
                onChange={(e) =>
                  onTracksChange((prev) => {
                    const ch = [...prev.chords];
                    ch[openTrack.index].detune = Number(e.target.value);
                    return { ...prev, chords: ch };
                  })
                }
                style={{ width: "100%" }}
              />
            </>
          )}
        </div>
      </div>
    );
  };

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  return (
    <div>
      <div style={{ marginBottom: "10px" }}>
        <button onClick={addChordRow}>Add Chord Row</button>
        <button onClick={clearChordRows} style={{ marginLeft: "8px" }}>
          Clear Chords
        </button>
      </div>

      {/* Drum Rows */}
      <div style={gridStyle}>
        {["kick", "snare", "hihat"].map((drumId) => (
          <div
            key={drumId}
            style={{
              gridColumn: "1",
              ...nameCellStyle,
            }}
            onClick={() => setOpenTrack({ type: "drum", id: drumId })}
          >
            {drumId.toUpperCase()}
          </div>
        ))}

        {["kick", "snare", "hihat"].map((drumId, rowIndex) =>
          sequence.map((_, step) => {
            const active = isActive(step, { type: "drum", drum: drumId });
            const highlighted = currentStep === step;

            return (
              <div
                key={`${drumId}-${step}`}
                style={cellStyle(active, highlighted)}
                onClick={() =>
                  handleToggle(step, { type: "drum", drum: drumId })
                }
              />
            );
          })
        )}
      </div>

      {/* Chord Rows */}
      {chords.map((ch, chordIndex) => (
        <div key={chordIndex} style={gridStyle}>
          <div
            style={nameCellStyle}
            onClick={() => setOpenTrack({ type: "chord", index: chordIndex })}
          >
            {ch.root} {ch.triad} {ch.extension}
          </div>

          {sequence.map((_, step) => {
            const active = isActive(step, {
              type: "chord",
              chordIndex,
            });

            const highlighted = currentStep === step;

            return (
              <div
                key={`chord-${chordIndex}-${step}`}
                style={cellStyle(active, highlighted)}
                onClick={() =>
                  handleToggle(step, {
                    type: "chord",
                    chordIndex,
                  })
                }
              />
            );
          })}
        </div>
      ))}

      {/* POPUP EDITOR */}
      <TrackEditor />
    </div>
  );
}
