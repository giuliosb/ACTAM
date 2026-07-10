import logging
import os
import tempfile
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask


# =============================================================================
# APPLICATION SETUP
# =============================================================================

# Create the FastAPI application.
# The title appears in the automatically generated API documentation at /docs.
app = FastAPI(title="Audio Processor API")


# Configure standard backend logging.
# Compared with print(), logging is better for production because it can be
# redirected, filtered by severity, and integrated with server logs.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION CONSTANTS
# =============================================================================

# Frontend URLs allowed to call this backend from a browser.
# This is required because browsers block cross-origin requests unless CORS
# explicitly allows them.
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://actam.vercel.app",
]


# MIME types accepted by the upload endpoint.
# file.content_type is provided by the client/browser and is used here as a
# first-level validation check before saving the uploaded file.
SUPPORTED_AUDIO_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/flac",
    "audio/x-flac",
}


# Default concert pitch reference.
# If tuning detection fails, the backend assumes A4 = 440 Hz.
DEFAULT_TUNING = 440.0


# Number of bytes read from the uploaded file at a time.
# 1024 * 1024 bytes = 1 MB.
# Reading in chunks prevents the whole uploaded file from being loaded into RAM.
UPLOAD_CHUNK_SIZE = 1024 * 1024


# Major and minor key templates used for tonality estimation.
# These are Krumhansl-Schmuckler pitch-class profiles.
#
# Each array has 12 values, one for each chromatic pitch class:
# C, C#, D, D#, E, F, F#, G, G#, A, A#, B
#
# Higher values indicate that a pitch class is more important for that mode.
# During tonality detection, the chromagram of the audio is compared against
# all 12 rotations of these templates.
MAJOR_TEMPLATE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)

MINOR_TEMPLATE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)


# Enable Cross-Origin Resource Sharing.
# This allows the frontend app to call this backend API from a different domain
# or port, for example when Vite runs on localhost:5173 and FastAPI runs on
# another port.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# RUNTIME STATE
# =============================================================================

# Path to the currently uploaded audio file.
#
# The current architecture stores only one active file globally.
# This preserves your original behavior, but it is not multi-user safe:
# if two users upload audio at the same time, the second upload replaces the
# first one.
#
# Production improvement:
# replace this global variable with user/session-specific storage.
CURRENT_FILE_PATH: str | None = None


# Detected tuning reference of the currently uploaded file.
#
# Example values:
# - 440.0 means standard A4 tuning
# - 442.0 means the uploaded file is approximately tuned to A4 = 442 Hz
#
# This value is used later to calculate how many semitones the audio must be
# shifted when the user requests a target tuning.
ORIGINAL_TUNING: float = DEFAULT_TUNING


# =============================================================================
# REQUEST MODELS
# =============================================================================

class ProcessRequest(BaseModel):
    """
    Request body for /get-audio.

    Fields:
        target_tuning:
            Desired A4 tuning reference in Hz.

            Examples:
            - 0 means no pitch shifting
            - 440 means shift the uploaded file to A4 = 440 Hz
            - 442 means shift the uploaded file to A4 = 442 Hz
    """

    target_tuning: float


# =============================================================================
# SHARED UTILITY FUNCTIONS
# =============================================================================

def get_current_audio_path() -> str:
    """
    Return the path of the currently uploaded audio file.

    This function centralizes validation used by several endpoints.

    Returns:
        The filesystem path stored in CURRENT_FILE_PATH.

    Raises:
        HTTPException 404:
            No file has been uploaded yet.

        HTTPException 400:
            CURRENT_FILE_PATH is set, but the file no longer exists on disk.
    """

    if CURRENT_FILE_PATH is None:
        raise HTTPException(status_code=404, detail="No file uploaded yet")

    if not os.path.exists(CURRENT_FILE_PATH):
        raise HTTPException(status_code=400, detail="Cannot read uploaded file")

    return CURRENT_FILE_PATH


def safe_delete(path: str | None) -> None:
    """
    Delete a file if it exists.

    Args:
        path:
            File path to delete. If None or empty, nothing happens.

    Why this helper exists:
        File cleanup should not crash the server in normal situations.
        For example, if a temporary file was already removed, the backend should
        continue running and only log the problem.
    """

    if not path:
        return

    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError as exc:
        logger.warning("Failed to delete file %s: %s", path, exc)


async def save_upload_file(file: UploadFile) -> str:
    """
    Save an uploaded audio file to the system temporary directory.

    Args:
        file:
            FastAPI UploadFile object received from the frontend.

    Returns:
        The full temporary path where the uploaded file was saved.

    Important variables:
        suffix:
            Original file extension, for example ".wav", ".mp3", or ".flac".
            Keeping the suffix helps audio libraries infer the file type.

        temp_path:
            Destination path for the uploaded file. This backend always saves
            the active upload as "current_audio" plus the original extension.

        chunk:
            A block of bytes read from the upload stream. Reading chunk by chunk
            avoids loading the entire audio file into memory.
    """

    suffix = Path(file.filename or "").suffix
    temp_path = os.path.join(tempfile.gettempdir(), f"current_audio{suffix}")

    with open(temp_path, "wb") as output:
        while chunk := await file.read(UPLOAD_CHUNK_SIZE):
            output.write(chunk)

    return temp_path


def load_audio(path: str) -> tuple[np.ndarray, int]:
    """
    Load an audio file from disk.

    Args:
        path:
            Path to the audio file.

    Returns:
        A tuple containing:
            y:
                NumPy array containing the audio waveform samples.

                In librosa, the conventional variable name for audio samples is
                "y". The values are floating-point amplitudes, usually in the
                range -1.0 to 1.0.

            sr:
                Sample rate of the audio file, in Hz.

                Example:
                - 44100 means 44,100 audio samples per second
                - 48000 means 48,000 audio samples per second

    Notes:
        sr=None tells librosa to preserve the original sample rate instead of
        resampling the file.
    """

    y, sr = librosa.load(path, sr=None)

    # Convert to float32 to reduce memory usage.
    # copy=False avoids copying the array if it is already float32.
    return y.astype(np.float32, copy=False), sr


def normalize_to_original_rms(processed: np.ndarray, original: np.ndarray) -> np.ndarray:
    """
    Normalize processed audio so its RMS level matches the original audio.

    Args:
        processed:
            Audio after processing, for example after pitch shifting.

        original:
            Audio before processing.

    Returns:
        Processed audio with adjusted loudness and clipping protection.

    Important variables:
        eps:
            A very small number used to avoid division by zero.

        rms_original:
            Root Mean Square level of the original audio.
            RMS is a common way to estimate signal loudness.

        rms_processed:
            Root Mean Square level of the processed audio.

        peak:
            Maximum absolute sample value in the processed audio.
            If peak is above 1.0, the audio may clip when written to disk.

    Why this is needed:
        Pitch shifting can change the measured loudness of the signal.
        This function restores a similar level to the original file and prevents
        clipping by scaling down peaks above 1.0.
    """

    eps = 1e-9

    rms_original = float(np.sqrt(np.mean(original**2) + eps))
    rms_processed = float(np.sqrt(np.mean(processed**2) + eps))

    if rms_processed > eps:
        processed = processed * (rms_original / rms_processed)

    peak = float(np.max(np.abs(processed))) if processed.size else 0.0

    if peak > 1.0:
        processed = processed / peak

    # Add slight headroom to reduce the chance of inter-sample clipping.
    # 0.98 is approximately -0.17 dB.
    return (processed * 0.98).astype(np.float32, copy=False)


def pitch_shift_to_tuning(
    y: np.ndarray,
    sr: int,
    original_tuning: float,
    target_tuning: float,
) -> np.ndarray:
    """
    Pitch-shift audio from its detected tuning to a target tuning.

    Args:
        y:
            Original audio waveform samples.

        sr:
            Sample rate of the audio in Hz.

        original_tuning:
            Detected A4 reference of the uploaded file.
            Example: 442.0 means the file is approximately tuned to A4 = 442 Hz.

        target_tuning:
            Desired A4 reference in Hz.
            0 means no pitch shifting.

    Returns:
        The pitch-shifted audio waveform.

    Important variables:
        semitones:
            Number of semitones needed to move from original_tuning to
            target_tuning.

            Positive value:
                pitch goes up.

            Negative value:
                pitch goes down.

            Example:
                shifting from 440 Hz to 880 Hz gives +12 semitones,
                which is one octave up.

    Formula:
        semitones = 12 * log2(target_tuning / original_tuning)
    """

    if target_tuning == 0:
        return y

    if target_tuning < 0:
        raise HTTPException(
            status_code=400,
            detail="target_tuning must be 0 or a positive frequency",
        )

    if original_tuning <= 0:
        original_tuning = DEFAULT_TUNING

    semitones = 12 * np.log2(target_tuning / original_tuning)

    shifted = librosa.effects.pitch_shift(
        y,
        sr=sr,
        n_steps=semitones,
    )

    shifted = shifted.astype(np.float32, copy=False)

    return normalize_to_original_rms(shifted, y)


def write_temp_flac(y: np.ndarray, sr: int) -> str:
    """
    Write audio samples to a temporary FLAC file.

    Args:
        y:
            Audio waveform samples to write.

        sr:
            Sample rate in Hz.

    Returns:
        Path to the generated FLAC file.

    Important variables:
        temp_file:
            Temporary file object created by Python.

        flac_path:
            Actual path on disk where the FLAC file will be written.

    Why delete=False:
        FileResponse needs a real file path to stream back to the frontend.
        If the temporary file is deleted immediately, FastAPI cannot send it.
        The file is instead deleted later using BackgroundTask.
    """

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".flac")
    flac_path = temp_file.name
    temp_file.close()

    sf.write(flac_path, y, sr, format="FLAC")

    return flac_path


# =============================================================================
# AUDIO ANALYSIS FUNCTIONS
# =============================================================================

def detect_tonality_from_file(audio_path: str) -> dict:
    """
    Estimate the musical key of an audio file.

    Args:
        audio_path:
            Path to the uploaded audio file.

    Returns:
        Dictionary with:
            key:
                Estimated key, for example "C major" or "A minor".

            confidence:
                Correlation score of the selected key profile.
                Higher values indicate a stronger match.

    Important variables:
        y:
            Audio waveform loaded by librosa.

        sr:
            Sample rate of the audio file.

        chroma:
            Chromagram matrix.
            A chromagram groups the audio energy into 12 pitch classes:
            C, C#, D, D#, E, F, F#, G, G#, A, A#, B.

        chroma_mean:
            Average energy of each pitch class over the full audio file.
            This gives a compact 12-value representation of the tonal content.

        major_scores:
            Correlation scores between the audio chroma profile and all 12
            possible major keys.

        minor_scores:
            Correlation scores between the audio chroma profile and all 12
            possible minor keys.

        best_major:
            Index of the best matching major key.

        best_minor:
            Index of the best matching minor key.

        key:
            Human-readable key name returned to the frontend.

        confidence:
            Best correlation value among all tested major/minor keys.
    """

    y, sr = librosa.load(audio_path, sr=None)

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)

    major_scores = [
        np.corrcoef(np.roll(chroma_mean, -i), MAJOR_TEMPLATE)[0, 1]
        for i in range(12)
    ]

    minor_scores = [
        np.corrcoef(np.roll(chroma_mean, -i), MINOR_TEMPLATE)[0, 1]
        for i in range(12)
    ]

    best_major = int(np.argmax(major_scores))
    best_minor = int(np.argmax(minor_scores))

    if max(major_scores) > max(minor_scores):
        key = f"{librosa.midi_to_note(60 + best_major, octave=False)} major"
        confidence = float(max(major_scores))
    else:
        key = f"{librosa.midi_to_note(60 + best_minor, octave=False)} minor"
        confidence = float(max(minor_scores))

    return {"key": key, "confidence": confidence}


def detect_bpm_from_file(audio_path: str) -> dict:
    """
    Estimate the tempo of an audio file.

    Args:
        audio_path:
            Path to the uploaded audio file.

    Returns:
        Dictionary with:
            bpm:
                Estimated tempo in beats per minute.

    Important variables:
        y:
            Audio waveform samples.

        sr:
            Sample rate in Hz.

        tempo:
            Estimated tempo returned by librosa.

        _:
            Beat frame positions returned by librosa.
            They are ignored here because the frontend only needs the BPM value.
    """

    y, sr = librosa.load(audio_path, sr=None)

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)

    return {"bpm": float(tempo)}


def detect_tuning_reference(
    audio_path: str,
    duration: float = 30.0,
    offset: float = 10.0,
) -> float:
    """
    Estimate the A4 tuning reference of an audio file.

    Args:
        audio_path:
            Path to the uploaded audio file.

        duration:
            Number of seconds to analyze.
            A shorter duration makes upload processing faster.

        offset:
            Number of seconds to skip before analysis starts.
            This avoids intros or silence at the very beginning of the track.

    Returns:
        Estimated A4 reference in Hz.

        Examples:
            440.0
            441.0
            442.0

    Important variables:
        y:
            Audio waveform from the selected excerpt.

        sr:
            Sample rate of the audio file.

        f0:
            Estimated fundamental frequency for each frame.
            A fundamental frequency is the perceived pitch of a voiced sound.

        voiced_flag:
            Boolean array indicating which frames contain a reliable voiced pitch.

        valid_freqs:
            Pitch values from f0 where:
            - the frame is voiced
            - the pitch is not NaN

        a4_estimates:
            List of possible A4 tuning references inferred from detected notes.

        freq:
            One detected pitch frequency from valid_freqs.

        midi_note:
            Continuous MIDI note estimate based on A4 = 440 Hz.

        nearest_midi:
            Nearest equal-tempered MIDI note.

        implied_a4:
            The A4 frequency that would make freq exactly match nearest_midi.

        detected_a4:
            Median value of all valid A4 estimates.
            Median is used because it is more robust against outliers than mean.

    Fallback behavior:
        If pitch detection fails or produces no reliable estimate, the function
        returns DEFAULT_TUNING.
    """

    try:
        y, sr = librosa.load(
            audio_path,
            sr=None,
            duration=duration,
            offset=offset,
        )

        f0, voiced_flag, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
            sr=sr,
        )

        valid_freqs = f0[(voiced_flag) & (~np.isnan(f0))]

        if len(valid_freqs) == 0:
            return DEFAULT_TUNING

        a4_estimates: list[float] = []

        for freq in valid_freqs:
            # Ignore physically unrealistic or musically irrelevant values.
            if freq < 20 or freq > 4000:
                continue

            midi_note = 69 + 12 * np.log2(freq / DEFAULT_TUNING)

            nearest_midi = round(midi_note)

            implied_a4 = freq / (2 ** ((nearest_midi - 69) / 12))

            # Keep only plausible tuning references.
            # This rejects bad pitch detections that would imply unrealistic
            # concert pitch values.
            if 430 <= implied_a4 <= 450:
                a4_estimates.append(float(implied_a4))

        if not a4_estimates:
            return DEFAULT_TUNING

        detected_a4 = np.median(a4_estimates)

        return float(round(detected_a4))

    except Exception as exc:
        logger.warning("Tuning detection failed for %s: %s", audio_path, exc)
        return DEFAULT_TUNING


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
def root():
    """
    Health-check endpoint.

    Returns:
        Simple message confirming that the backend is running.
    """

    return {"message": "Audio Processor Backend is running!"}


@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """
    Upload an audio file and detect its tuning.

    Args:
        file:
            Audio file sent by the frontend as multipart/form-data.

    Returns:
        JSON response with:
            message:
                Confirmation that the file was uploaded.

            tuning:
                Detected A4 tuning reference of the uploaded file.

    Important variables:
        CURRENT_FILE_PATH:
            Updated to point to the newly uploaded temporary file.

        ORIGINAL_TUNING:
            Updated to the detected tuning of the uploaded file.

        detected_tuning:
            Result returned by detect_tuning_reference().
    """

    global CURRENT_FILE_PATH
    global ORIGINAL_TUNING

    if file.content_type not in SUPPORTED_AUDIO_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload WAV, MP3, or FLAC.",
        )

    # Remove the previous upload before storing the new one.
    # This preserves the original one-file-at-a-time behavior.
    safe_delete(CURRENT_FILE_PATH)

    CURRENT_FILE_PATH = await save_upload_file(file)

    logger.info("Uploaded audio saved to %s", CURRENT_FILE_PATH)

    detected_tuning = detect_tuning_reference(
        CURRENT_FILE_PATH,
        duration=30.0,
        offset=10.0,
    )

    ORIGINAL_TUNING = detected_tuning

    return {
        "message": "File uploaded successfully",
        "tuning": detected_tuning,
    }


@app.get("/get-tuning")
async def get_tuning():
    """
    Return the detected tuning of the currently uploaded audio file.

    Returns:
        JSON response with:
            tuning:
                Last detected A4 reference in Hz.
    """

    return {"tuning": ORIGINAL_TUNING}


@app.get("/getTonality")
async def get_tonality():
    """
    Return the estimated musical key of the current uploaded file.

    Returns:
        JSON response with:
            key:
                Estimated key, for example "C major".

            confidence:
                Correlation confidence score.

    Notes:
        The route name is kept as /getTonality to preserve frontend compatibility.
    """

    audio_path = get_current_audio_path()

    try:
        return detect_tonality_from_file(audio_path)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Tonality detection failed: {exc}",
        )


@app.get("/getBppmDetector")
async def get_bpm_detector():
    """
    Return the estimated BPM of the current uploaded file.

    Returns:
        JSON response with:
            bpm:
                Estimated tempo in beats per minute.

    Notes:
        The route name appears to contain a typo: "Bppm".
        It is intentionally kept unchanged to avoid breaking the frontend.
    """

    audio_path = get_current_audio_path()

    try:
        return detect_bpm_from_file(audio_path)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"BPM detection failed: {exc}",
        )


@app.post("/get-audio")
async def get_and_process_audio(req: ProcessRequest):
    """
    Process the current audio file and return it as FLAC.

    Args:
        req:
            Parsed JSON request body.

            req.target_tuning:
                Desired tuning reference in Hz.
                0 means return the audio without pitch shifting.

    Returns:
        FileResponse:
            Processed audio file as processed_audio.flac.

    Important variables:
        audio_path:
            Path of the currently uploaded audio file.

        y:
            Audio waveform samples loaded from the uploaded file.

        sr:
            Sample rate of the uploaded file.

        flac_path:
            Path of the temporary processed FLAC file.

    Processing behavior:
        - If target_tuning is 0:
            the uploaded file is converted to FLAC without pitch shifting.

        - If target_tuning is greater than 0:
            the audio is pitch-shifted from ORIGINAL_TUNING to target_tuning.

    Cleanup:
        The generated FLAC file is deleted after the response has been sent.
    """

    audio_path = get_current_audio_path()

    try:
        y, sr = load_audio(audio_path)

        y = pitch_shift_to_tuning(
            y=y,
            sr=sr,
            original_tuning=ORIGINAL_TUNING,
            target_tuning=req.target_tuning,
        )

        flac_path = write_temp_flac(y, sr)

        return FileResponse(
            flac_path,
            media_type="audio/flac",
            filename="processed_audio.flac",
            background=BackgroundTask(safe_delete, flac_path),
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing audio: {exc}",
        )


@app.post("/clear")
def clear_temp():
    """
    Delete the currently uploaded temporary audio file.

    Returns:
        JSON response confirming whether a file was deleted.

    Important variables:
        CURRENT_FILE_PATH:
            If it points to an existing file, that file is deleted.
            The variable is then reset to None.
    """

    global CURRENT_FILE_PATH

    if not CURRENT_FILE_PATH:
        return {"message": "No file to clear"}

    try:
        safe_delete(CURRENT_FILE_PATH)
        CURRENT_FILE_PATH = None

        return {"message": "Temporary file cleared"}

    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete temp file: {exc}",
        )