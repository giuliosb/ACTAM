/**
 * Ordered list of drum tracks rendered by the sequencer.
 *
 * This order controls:
 * - row order in the grid
 * - snapshot export structure
 * - snapshot rebuild behavior
 */
export const DRUM_IDS = ["kick", "snare", "hihat", "openhat"];

/**
 * Returns a safe array. Used for props that may temporarily be undefined/null.
 *
 * Variables:
 * - value: Unknown input value.
 * - fallback: Array returned when value is not an array.
 */
export function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

/**
 * Returns a safe object. Used for optional track maps/settings.
 *
 * Variables:
 * - value: Unknown input value.
 * - fallback: Object returned when value is null or not an object.
 */
export function asObject(value, fallback = {}) {
  return value && typeof value === "object" ? value : fallback;
}

/**
 * Triggers either a sample-like node with start() or a synth-like node with triggerAttackRelease().
 *
 * Variables:
 * - node: Tone source/synth instance to trigger.
 * - note: Optional pitch for synth-like drums such as kick.
 * - duration: Tone.js note duration, for example "8n" or "4n".
 * - time: Tone.Transport scheduled time, supplied by scheduleRepeat.
 */
export function triggerDrumNode(node, note, duration, time) {
  if (!node) return;

  try {
    if (typeof node.start === "function") {
      node.start(time);
    } else if (typeof node.triggerAttackRelease === "function") {
      node.triggerAttackRelease(note, duration, time);              //TODO what is this
    }
  } catch (error) {
    console.warn("Drum trigger failed", error);
  }
}

/**
 * Extracts positive numeric frequencies from a chord note array.
 *
 * Variables:
 * - notes: Chord notes, each expected to contain a numeric freq property.
 */
export function getChordFrequencies(notes) {
  return asArray(notes)
    .map((note) => (note && typeof note.freq === "number" && note.freq > 0 ? note.freq : null))
    .filter(Boolean);                                              //TODO what is thiss .filter
}

/**
 * Converts a step sustain multiplier into seconds.
 *
 * Variables:
 * - sustainFactor: Event sustain multiplier. Defaults to 1 when invalid.
 * - bpm: Current tempo used to calculate one sixteenth-note step duration.
 */
export function getSustainSeconds(sustainFactor, bpm) {
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
  const stepDuration = 60 / safeBpm / 4;
  const factor = Number.isFinite(sustainFactor) ? sustainFactor : 1;        //TODO what is this factor

  return Math.max(0.03, factor * stepDuration);
}

/**
 * Applies live drum volumes from the track state to the Tone drum nodes.
 *
 * Variables:
 * - drums: Object containing kick, snare, hihat, and openhat nodes.
 * - drumTracks: Track state for drum enabled flags and volumes.
 */
export function applyDrumVolumes(drums, drumTracks) {
  for (const drumId of DRUM_IDS) {
    const node = drums?.[drumId];
    if (node) node.volume.value = drumTracks?.[drumId]?.volume ?? 0;
  }
}
