// Global musical configuration and default track shapes

export const STEPS = 64;

// Pitch system
export const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

export const TRIADS = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  "Dim (-)" :   [0, 3, 6],
  "Aug (+)" :   [0, 4, 8],
};

export const EXTENSIONS = {
  "": null,
  "7": 10,
  "Maj7": 11,
  "m7": 10,
  "6": 9,
  "9": 14,
  "11": 17,
  "13": 21,
  "Add9": 14,
  "Sus2": 2,
  "Sus4": 5,
};

// Default shape for a new chord track //TODO: remove if not used
export const DEFAULT_CHORD_TRACK = {
  instrument: "fm",
  volume: -8,
  cutoff: 1500,
  reverbMix: 0.3,
  chorusMix: 0.5,
  detune: 0,
};

// Utility per creare una sequenza vuota
export const createEmptySequence = (steps = STEPS) =>
  Array.from({ length: steps }, () => []);
