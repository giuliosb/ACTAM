import React from "react";

export default function TrackEditor({
  openTrack,
  setOpenTrack,
  tracks,
  onTracksChange,
  chords,
  onChordsChange,
  sequence,
  onSequenceChange,
  removeChord
}) {
  if (!openTrack) return null;

  const close = () => setOpenTrack(null);

  const changeDrumParam = (drumId, param, value) => {
    onTracksChange(prev => ({
      ...prev,
      drums: {
        ...prev.drums,
        [drumId]: {
          ...(prev.drums?.[drumId] ?? {}),
          [param]: value
        }
      }
    }));
  };

  const changeChordTrackParam = (index, param, value) => {
    onTracksChange(prev => {
      const arr = [...(prev.chords || [])];
      arr[index] = { ...(arr[index] || {}), [param]: value };
      return { ...prev, chords: arr };
    });
  };

  const drumTrack =
    openTrack.type === "drum"
      ? tracks.drums?.[openTrack.id] ?? { volume: 0, swing: 0 }
      : null;

  const chordTrack =
    openTrack.type === "chord"
      ? tracks.chords?.[openTrack.index] ?? {
          instrument: "fm",
          volume: -8,
          cutoff: 1500,
          reverbMix: 0.3,
          chorusMix: 0.5,
          detune: 0
        }
      : null;

  return (
    <div
      className="track-editor-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backdropFilter: "blur(2px)",
        zIndex: 999
      }}
    >
      <div
        className="track-editor"
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          minWidth: "320px",
          position: "relative",
          boxShadow: "0 0 20px rgba(0,0,0,0.3)"
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
            borderRadius: "4px"
          }}
        >
          X
        </button>

        {/* DRUM TRACK */}
        {openTrack.type === "drum" && drumTrack && (
          <>
            <h2>{openTrack.id.toUpperCase()} Settings</h2>

            <label>Volume (dB)</label>
            <input
              type="range"
              min="-30"
              max="6"
              value={drumTrack.volume ?? 0}
              onChange={e =>
                changeDrumParam(openTrack.id, "volume", Number(e.target.value))
              }
              style={{ width: "100%" }}
            />
            <div>{drumTrack.volume ?? 0} dB</div>

            <label>Swing</label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={drumTrack.swing ?? 0}
              onChange={e =>
                changeDrumParam(openTrack.id, "swing", Number(e.target.value))
              }
              style={{ width: "100%" }}
            />
            <div>{Math.round((drumTrack.swing ?? 0) * 100)}%</div>
          </>
        )}

        {/* CHORD TRACK */}
        {openTrack.type === "chord" && chordTrack && (
          <>
            <h2
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px"
              }}
            >
              <span>Chord {openTrack.index + 1}</span>
              <button
                onClick={() => {
                  removeChord(openTrack.index);
                  close();
                }}
                style={{
                  background: "#d9534f",
                  color: "#fff",
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: "4px"
                }}
              >
                Delete
              </button>
            </h2>

            {/* 🎹 Instrument Selector */}
            <label>Instrument</label>
            <select
              value={chordTrack.instrument || "fm"}
              onChange={(e) =>
                changeChordTrackParam(openTrack.index, "instrument", e.target.value)
              }
              style={{ width: "100%", marginBottom: "12px" }}
            >
              <option value="fm">FM Synth</option>
              <option value="sinepad">Sine Pad</option>
              <option value="saw">Saw Lead</option>
              <option value="organ">Organ</option>
              <option value="piano">Electric Piano</option>
            </select>

            {/* Volume */}
            <label>Volume (dB)</label>
            <input
              type="range"
              min="-30"
              max="6"
              value={chordTrack.volume}
              onChange={e =>
                changeChordTrackParam(openTrack.index, "volume", Number(e.target.value))
              }
              style={{ width: "100%" }}
            />

            {/* Filter */}
            <label>Filter cutoff</label>
            <input
              type="range"
              min="300"
              max="8000"
              value={chordTrack.cutoff}
              onChange={e =>
                changeChordTrackParam(openTrack.index, "cutoff", Number(e.target.value))
              }
              style={{ width: "100%" }}
            />

            {/* Reverb */}
            <label>Reverb</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={chordTrack.reverbMix}
              onChange={e =>
                changeChordTrackParam(openTrack.index, "reverbMix", Number(e.target.value))
              }
              style={{ width: "100%" }}
            />

            {/* Chorus */}
            <label>Chorus</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={chordTrack.chorusMix}
              onChange={e =>
                changeChordTrackParam(openTrack.index, "chorusMix", Number(e.target.value))
              }
              style={{ width: "100%" }}
            />

            {/* Detune */}
            <label>Detune</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={chordTrack.detune}
              onChange={e =>
                changeChordTrackParam(openTrack.index, "detune", Number(e.target.value))
              }
              style={{ width: "100%" }}
            />
          </>
        )}
      </div>
    </div>
  );
}
