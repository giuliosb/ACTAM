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
  // If no track is selected, don't render the popup
  if (!openTrack) return null;

  // Close popup
  const close = () => setOpenTrack(null);

  /* ---------------------------------------------------------
     UPDATE A DRUM PARAMETER (volume, swing, etc.)
  --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
     UPDATE A CHORD TRACK PARAMETER (volume, cutoff, etc.)
  --------------------------------------------------------- */
  const changeChordTrackParam = (index, param, value) => {
    onTracksChange(prev => {
      const arr = [...(prev.chords || [])];
      arr[index] = { ...(arr[index] || {}), [param]: value };
      return { ...prev, chords: arr };
    });
  };

  /* ---------------------------------------------------------
     RESOLVE WHICH TRACK WE ARE EDITING
     - drumTrack → openTrack.type === "drum"
     - chordTrack → openTrack.type === "chord"
  --------------------------------------------------------- */
  const drumTrack =
    openTrack.type === "drum"
      ? tracks.drums?.[openTrack.id] ?? { volume: 0, swing: 0 }
      : null;

  const chordTrack =
    openTrack.type === "chord"
      ? tracks.chords?.[openTrack.index] ?? {
          volume: -8,
          cutoff: 1500,
          reverbMix: 0.3,
          chorusMix: 0.5,
          detune: 0
        }
      : null;

  /* ---------------------------------------------------------
     UI POPUP
     NOTE: markup identical to your original version
  --------------------------------------------------------- */

  return (
    <div
      className="track-editor-overlay"
      onClick={e => {
        // Close only when clicking the dark background
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
        onMouseDown={e => e.stopPropagation()}
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          minWidth: "320px",
          position: "relative",
          boxShadow: "0 0 20px rgba(0,0,0,0.3)"
        }}
      >
        {/* Close button */}
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

        {/* ---------------------------------------------------------
           DRUM TRACK UI
        --------------------------------------------------------- */}
        {openTrack.type === "drum" && drumTrack && (
          <>
            <h2 style={{ marginBottom: "10px" }}>
              {openTrack.id.toUpperCase()} Settings
            </h2>

            {/* VOLUME */}
            <label>Volume (dB)</label>
            <input
              type="range"
              min="-30"
              max="6"
              step="1"
              value={drumTrack.volume ?? 0}
              onChange={e =>
                changeDrumParam(
                  openTrack.id,
                  "volume",
                  Number(e.target.value)
                )
              }
              style={{ width: "100%" }}
            />
            <div style={{ marginBottom: "15px" }}>
              {drumTrack.volume ?? 0} dB
            </div>

            {/* SWING */}
            <label>Swing</label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={drumTrack.swing ?? 0}
              onChange={e =>
                changeDrumParam(
                  openTrack.id,
                  "swing",
                  Number(e.target.value)
                )
              }
              style={{ width: "100%" }}
            />
            <div>{Math.round((drumTrack.swing ?? 0) * 100)}%</div>
          </>
        )}

        {/* ---------------------------------------------------------
           CHORD TRACK UI
        --------------------------------------------------------- */}
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

              {/* Delete chord button */}
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
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Delete
              </button>
            </h2>

            {/* VOLUME */}
            <label>Volume (dB)</label>
            <input
              type="range"
              min="-30"
              max="6"
              step="1"
              value={chordTrack.volume}
              onChange={e =>
                changeChordTrackParam(
                  openTrack.index,
                  "volume",
                  Number(e.target.value)
                )
              }
              style={{ width: "100%" }}
            />

            {/* FILTER CUTOFF */}
            <label>Filter cutoff</label>
            <input
              type="range"
              min="300"
              max="8000"
              value={chordTrack.cutoff}
              onChange={e =>
                changeChordTrackParam(
                  openTrack.index,
                  "cutoff",
                  Number(e.target.value)
                )
              }
              style={{ width: "100%" }}
            />

            {/* REVERB */}
            <label>Reverb</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={chordTrack.reverbMix}
              onChange={e =>
                changeChordTrackParam(
                  openTrack.index,
                  "reverbMix",
                  Number(e.target.value)
                )
              }
              style={{ width: "100%" }}
            />

            {/* CHORUS */}
            <label>Chorus</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={chordTrack.chorusMix}
              onChange={e =>
                changeChordTrackParam(
                  openTrack.index,
                  "chorusMix",
                  Number(e.target.value)
                )
              }
              style={{ width: "100%" }}
            />

            {/* DETUNE */}
            <label>Detune</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={chordTrack.detune}
              onChange={e =>
                changeChordTrackParam(
                  openTrack.index,
                  "detune",
                  Number(e.target.value)
                )
              }
              style={{ width: "100%" }}
            />
          </>
        )}
      </div>
    </div>
  );
}
