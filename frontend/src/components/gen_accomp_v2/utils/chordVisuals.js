/**
 * Presentation metadata for chord rendering.
 *
 * This file uses Map instead of plain object lookup because strict TypeScript
 * checking can complain when dynamic chord values are used to index objects.
 */

/**
 * @typedef {Object} Chord
 * 
 * @property {string} root
 * Musical root of the chord
 *
 * @property {string} triad
 * Triad quality, for example "Major", "Minor", "Dim (-)", or "Aug (+)".
 *
 * @property {string} [extension]
 * Optional chord extension, for example "7", "Maj7", "Sus4", or "Add9".
 */

/**
 * @typedef {Object} ChordVisuals
 * @property {string} rootClass
 * CSS-safe class suffix for the chord root.
 *
 * @property {string} triadClass
 * CSS-safe class suffix for the chord triad.
 *
 * @property {string} extLabel
 * Compact extension label rendered through the chord cell data attribute.
 */

/**
 * Maps musical chord roots to CSS-safe class suffixes.
 *
 * Variable explanation:
 * - key: musical root name stored in the chord object
 * - value: CSS-safe suffix used to build classes like `chord-root-fsharp`
 *
 * @type {Map<string, string>}
 */
const ROOT_CLASS_MAP = new Map([
  ["C", "c"],
  ["G", "g"],
  ["D", "d"],
  ["A", "a"],
  ["E", "e"],
  ["B", "b"],
  ["F#", "fsharp"],
  ["C#", "csharp"],
  ["D#", "dsharp"],
  ["G#", "gsharp"],
  ["A#", "asharp"],
  ["Db", "db"],
  ["Eb", "eb"],
  ["Ab", "ab"],
  ["Bb", "bb"],
  ["F", "f"],
]);

/**
 * Maps chord triad names to CSS-safe class suffixes.
 *
 * Variable explanation:
 * - "Major" becomes `triad-major`
 * - "Minor" becomes `triad-minor`
 * - "Dim (-)" becomes `triad-dim`
 * - "Aug (+)" becomes `triad-aug`
 *
 * @type {Map<string, string>}
 */
const TRIAD_CLASS_MAP = new Map([
  ["Major", "major"],
  ["Minor", "minor"],
  ["Dim (-)", "dim"],
  ["Aug (+)", "aug"],
]);

/**
 * Optional visual prefix for special triad types.
 *
 * Variable explanation:
 * - diminished chords get "-"
 * - augmented chords get "+"
 * - major/minor chords do not need an extra prefix
 *
 * @type {Map<string, string>}
 */
const TRIAD_LABEL_MAP = new Map([
  ["Dim (-)", "-"],
  ["Aug (+)", "+"],
]);

/**
 * Maps chord extension names to compact UI labels.
 *
 * Variable explanation:
 * - key: extension value stored in the chord object
 * - value: compact label shown in the chord cell
 *
 * @type {Map<string, string>}
 */
const EXT_LABEL_MAP = new Map([
  ["", ""],
  ["6", "6"],
  ["7", "7"],
  ["m7", "m7"],
  ["Maj7", "Δ7"],
  ["9", "9"],
  ["11", "11"],
  ["13", "13"],
  ["Add9", "add9"],
  ["Sus2", "sus2"],
  ["Sus4", "sus4"],
]);

/**
 * Converts a chord object into UI-only visual metadata.
 *
 * This function does not modify the chord itself. It only converts musical
 * chord data into CSS class fragments and compact labels used by the sequencer.
 *
 * @param {Chord | null | undefined} chord
 * Chord object selected from the chord library.
 *
 * @returns {Partial<ChordVisuals>}     //TODO what is this Partial
 * Visual metadata for rendering:
 * - rootClass: root CSS suffix
 * - triadClass: triad CSS suffix
 * - extLabel: compact extension label
 */
export function getChordVisuals(chord) {
  if (!chord) return {};

  const rootClass = ROOT_CLASS_MAP.get(chord.root) || "";
  const triadClass = TRIAD_CLASS_MAP.get(chord.triad) || "";
  const triadPrefix = TRIAD_LABEL_MAP.get(chord.triad) || "";

  const extension = chord.extension || "";
  const extSuffix = EXT_LABEL_MAP.get(extension) ?? extension;
  const extLabel = `${triadPrefix}${extSuffix}`;

  return {
    rootClass,
    triadClass,
    extLabel,
  };
}