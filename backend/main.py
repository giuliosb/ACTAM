
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
import tempfile
import numpy as np
import librosa
import soundfile as sf
import os
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from typing import Optional

app = FastAPI(title="Audio Processor API")

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://actam.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global variable to track the currently uploaded file
CURRENT_FILE_PATH = None

# --- GLOBAL ORIGINAL AND CURRENT TUNING OF UPLOADED AUDIO ---
ORIGINAL_TUNING = 440

# --- TONALITY DETECTOR ENDPOINT ---
@app.get("/getTonality")
async def get_tonality():
    """Detect the tonality (key) of the last uploaded audio file using librosa."""
    global CURRENT_FILE_PATH
    if CURRENT_FILE_PATH is None or not os.path.exists(CURRENT_FILE_PATH):
        raise HTTPException(status_code=404, detail="No file uploaded yet")
    try:
        y, sr = librosa.load(CURRENT_FILE_PATH, sr=None)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = chroma.mean(axis=1)
        # Major and minor key templates (Krumhansl-Schmuckler)
        major_template = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_template = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
        # Correlate with all 12 keys
        major_scores = [np.corrcoef(np.roll(chroma_mean, -i), major_template)[0, 1] for i in range(12)]
        minor_scores = [np.corrcoef(np.roll(chroma_mean, -i), minor_template)[0, 1] for i in range(12)]
        best_major = int(np.argmax(major_scores))
        best_minor = int(np.argmax(minor_scores))
        if max(major_scores) > max(minor_scores):
            key = librosa.midi_to_note(60 + best_major, octave=False) + ' major'
            confidence = float(max(major_scores))
        else:
            key = librosa.midi_to_note(60 + best_minor, octave=False) + ' minor'
            confidence = float(max(minor_scores))
        return {"key": key, "confidence": confidence}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tonality detection failed: {str(e)}")

# --- BPM DETECTOR ENDPOINT ---
@app.get("/getBppmDetector")
async def get_bpm_detector():
    """Detect the BPM of the last uploaded audio file using librosa."""
    global CURRENT_FILE_PATH
    if CURRENT_FILE_PATH is None or not os.path.exists(CURRENT_FILE_PATH):
        raise HTTPException(status_code=404, detail="No file uploaded yet")
    try:
        y, sr = librosa.load(CURRENT_FILE_PATH, sr=None)
        # Use librosa's beat tracker
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        return {"bpm": float(tempo)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BPM detection failed: {str(e)}")

class ProcessRequest(BaseModel):
    stretch_rate: float
    target_tuning: float  # Target A4 frequency in Hz


@app.get("/")
def root():
    return {"message": "Audio Processor Backend is running!"}

@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """Upload an audio file temporarily and replace the previous one."""
    global CURRENT_FILE_PATH
    global ORIGINAL_TUNING

    # --- CHECKING FILE TYPE ---
    if file.content_type not in ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/flac", "audio/x-flac"]:
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload WAV or MP3.")
    # -----------------------------------------


    # Use a system temporary directory (auto-deleted when the server restarts)
    temp_dir = tempfile.gettempdir()
    temp_filename = os.path.join(temp_dir, f"current_audio{os.path.splitext(file.filename)[1]}")

    # If there's a previously uploaded file, delete it
    if CURRENT_FILE_PATH and os.path.exists(CURRENT_FILE_PATH):
        try:
            os.remove(CURRENT_FILE_PATH)
        except Exception as e:
            print(f"Failed to delete previous file: {e}")

    # --- Save the new file (streaming, no full RAM read) ---
    with open(temp_filename, "wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)  # 1MB
            if not chunk:
                break
            out.write(chunk)

    CURRENT_FILE_PATH = temp_filename
    print("UPLOAD saved:", CURRENT_FILE_PATH)

    # --- Detect tuning on a short excerpt (fast) ---
    try:
        print("TUNING detection start")
        detected_tuning = detect_tuning_reference(CURRENT_FILE_PATH, duration=30.0, offset=10.0)
        ORIGINAL_TUNING = detected_tuning
        print("TUNING detection done:", detected_tuning)
        return {"message": "File uploaded successfully", "tuning": detected_tuning}
    except Exception as e:
        print(f"Failed to detect tuning: {e}")
        ORIGINAL_TUNING = 440
        return {
            "message": "File uploaded successfully",
            "tuning": 440,
            "tuning_detection_error": str(e),
        }

@app.get("/get-tuning")
async def get_tunning():
    """Get the tuning of upload audio file."""
    global ORIGINAL_TUNING

    return {
            "tuning": ORIGINAL_TUNING
        }
   
        

@app.post("/clear")
def clear_temp():
    """Delete the current temporary file."""
    global CURRENT_FILE_PATH
    if CURRENT_FILE_PATH and os.path.exists(CURRENT_FILE_PATH):
        try:
            os.remove(CURRENT_FILE_PATH)
            CURRENT_FILE_PATH = None
            return {"message": "Temporary file cleared"}
        except OSError as e:
            # Return controlled error instead of leaking internal exception
            raise HTTPException(status_code=500, detail=f"Failed to delete temp file: {e}")
    return {"message": "No file to clear"}


class ProcessRequest(BaseModel):
    #stretch_rate: float
    target_tuning: float  # Target A4 frequency in Hz

# TODO: Put the audioprocessing segment into a separate function that returns the file

@app.post("/get-audio")
async def get_and_process_audio(req: ProcessRequest):
    """
    Process and return the audio file with optional time stretching and pitch shifting.

    Args:
        target_tuning: Target A4 frequency in Hz (0 = no pitch shift, 440, 442, etc.)

    Returns:
        Processed audio file
    """
    global CURRENT_FILE_PATH
    global ORIGINAL_TUNING

    if CURRENT_FILE_PATH is None:
        raise HTTPException(status_code=404, detail="No file uploaded yet")

    if not os.path.exists(CURRENT_FILE_PATH):
        raise HTTPException(status_code=400, detail="Cannot read file")

    try:
        try:
            # Load audio file
            y, sr = librosa.load(CURRENT_FILE_PATH, sr=None)
            y = y.astype(np.float32, copy=False)

            eps = 1e-9
            rms_orig = float(np.sqrt(np.mean(y**2) + eps))

            #____________Pitch_shift____________
            if req.target_tuning != 0:
                original_tuning = ORIGINAL_TUNING

                # Calculate pitch shift in semitones
                semitones = 12 * np.log2(req.target_tuning / original_tuning)

                # Apply pitch shifting
                y_shifted = librosa.effects.pitch_shift(y, sr=sr, n_steps=semitones)
                y_shifted = y_shifted.astype(np.float32, copy=False)

                # ---- FIX 1: match RMS (no need to keep y_orig) ----
                rms_shifted = float(np.sqrt(np.mean(y_shifted**2) + eps))
                if rms_shifted > eps:
                    gain = rms_orig / rms_shifted
                    y_shifted *= gain

                # ---- Safety: prevent clipping + small headroom ----
                peak = float(np.max(np.abs(y_shifted))) if y_shifted.size else 0.0
                if peak > 1.0:
                    y_shifted /= peak

                y_shifted *= 0.98  # ~0.17 dB headroom

                y = y_shifted

            #___________Time_stretch____________
            # (not used)

        except Exception as e:
            raise Exception(f"Error processing the audio: {str(e)}")

        temp_flac = tempfile.NamedTemporaryFile(delete=False, suffix=".flac")
        flac_path = temp_flac.name
        temp_flac.close()

        sf.write(flac_path, y, sr, format="FLAC")

        return FileResponse(
            flac_path,
            media_type="audio/flac",
            filename="processed_audio.flac",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")



# NOT API CALL FUNCTIONS:

def detect_tuning_reference(audio_path: str, duration: float = 30.0, offset: float = 10.0) -> float:
    """
    Detect the tuning reference frequency (A4) of an audio file.
    
    Args:
        audio_path: Path to the audio file
        
    Returns:
        Detected A4 frequency in Hz (e.g., 440, 442, etc.)
    """
    try:
        # Load audio file
        y, sr = librosa.load(audio_path, sr=None, duration=duration, offset=offset)
        
        # Use pyin for pitch detection
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y,
            fmin=librosa.note_to_hz('C2'),  # ~65 Hz
            fmax=librosa.note_to_hz('C7'),  # ~2093 Hz
            sr=sr
        )
        
        # Filter out unvoiced segments and NaN values
        valid_freqs = f0[(voiced_flag) & (~np.isnan(f0))]
        
        if len(valid_freqs) == 0:
            # Default to 440 Hz if no valid frequencies detected
            return 440.0
        
        # For each detected frequency, calculate what A4 would be
        # Formula: A4 = detected_freq * 2^((69 - midi_note) / 12)
        # where midi_note = 69 + 12 * log2(detected_freq / A4_reference)
        
        a4_estimates = []
        
        for freq in valid_freqs:
            if freq < 20 or freq > 4000:  # Skip unrealistic frequencies
                continue
                
            # Convert frequency to MIDI note number assuming A4=440Hz
            midi_note = 69 + 12 * np.log2(freq / 440.0)
            
            # Round to nearest semitone to identify the note
            nearest_midi = round(midi_note)
            
            # Calculate what A4 frequency would produce this note at this frequency
            # freq = A4 * 2^((nearest_midi - 69) / 12)
            # A4 = freq / 2^((nearest_midi - 69) / 12)
            implied_a4 = freq / (2 ** ((nearest_midi - 69) / 12))
            
            # Only keep reasonable A4 estimates (between 430-450 Hz)
            if 430 <= implied_a4 <= 450:
                a4_estimates.append(implied_a4)
        
        if len(a4_estimates) == 0:
            # Default to 440 Hz if no valid estimates
            return 440.0
        
        # Use median to avoid outliers
        detected_a4 = np.median(a4_estimates)
        
        # Round to nearest integer Hz
        return round(detected_a4)
    except Exception as e:
        # Fallback: log and return safe default instead of propagating
        print(f"Tuning detection error on {audio_path}: {e}")
        return 440.0


# Not used functions:
def apply_pitch_shift(target_tuning: float):
    """
    Pitch shift the current audio file to a target tuning and overwrite it.
    
    Args:
        target_tuning: Target A4 frequency in Hz (e.g., 440, 442)
    """
    global CURRENT_FILE_PATH
    global ORIGINAL_TUNING
    
    # Check if file exists
    if not CURRENT_FILE_PATH or not os.path.exists(CURRENT_FILE_PATH):
        raise Exception("No file uploaded yet")
    
    try:
        # Use the global tuning
        og_tuning = ORIGINAL_TUNING
        
        # Calculate pitch shift in semitones
        # Formula: semitones = 12 * log2(target_freq / current_freq)
        semitones = 12 * np.log2(target_tuning / og_tuning)
        
        # Load audio file
        y, sr = librosa.load(CURRENT_FILE_PATH, sr=None, mono=False, dtype=np.float32)
        
        # Apply pitch shifting
        y = librosa.effects.pitch_shift(y, sr=sr, n_steps=semitones).astype(np.float32, copy=False)
        
        # Overwrite the current file with pitch-shifted audio
        sf.write(CURRENT_FILE_PATH, y, sr)
        
        
        print(f"Pitch shifted from {ORIGINAL_TUNING}Hz to {target_tuning}Hz")
        
    except Exception as e:
        raise Exception(f"Error pitch shifting audio: {str(e)}")

def apply_time_stretch(stretch_rate: float):
    """
    Time-stretch the current audio file and overwrite it.
    
    Args:
        stretch_rate: Time stretch factor (0.5 = slower, 2.0 = faster)
    """
    global CURRENT_FILE_PATH
    
    # Check if file exists
    if not CURRENT_FILE_PATH or not os.path.exists(CURRENT_FILE_PATH):
        raise Exception("No file uploaded yet")
    
    try:
        # Load audio file
        y, sr = librosa.load(CURRENT_FILE_PATH, sr=None)
        
        # Apply time stretching
        y_stretched = librosa.effects.time_stretch(y, rate=stretch_rate)
        
        # Overwrite the current file with stretched audio
        sf.write(CURRENT_FILE_PATH, y_stretched, sr)
        
        print(f"Time stretched audio by factor {stretch_rate}x")
        
    except Exception as e:
        raise Exception(f"Error time stretching audio: {str(e)}")

def process_audio(target_tuning: float, stretch_rate: float):
    """
    Processing of the current audio file and overwrite it.
    -Pitch shift the audio file to a target tuning.
    -Time-stretch the audio file.
    Args:
        target_tuning: Target A4 frequency in Hz
        stretch_rate: Time stretch factor 
    """
    global CURRENT_FILE_PATH
    global ORIGINAL_TUNING
    
    # Check if file exists
    if not CURRENT_FILE_PATH or not os.path.exists(CURRENT_FILE_PATH):
        raise Exception("No file uploaded yet")
    
    try:
        # Load audio file
        y, sr = librosa.load(CURRENT_FILE_PATH, sr=None)

        #____________Pitch_shift____________
        
        if target_tuning != 0:
            # Use the global tuning
            og_tuning = ORIGINAL_TUNING

            # Calculate pitch shift in semitones
            # Formula: semitones = 12 * log2(target_freq / current_freq)
            semitones = 12 * np.log2(target_tuning / og_tuning)

            # Apply pitch shifting
            y_shifted = librosa.effects.pitch_shift(y, sr=sr, n_steps=semitones)

            y = y_shifted


            print(f"Pitch shifted from {ORIGINAL_TUNING}Hz to {target_tuning}Hz")

        #___________Time_stretch____________
        
        if stretch_rate != 0:
            # Apply time stretching
            y_stretched = librosa.effects.time_stretch(y, rate=stretch_rate)
            y = y_stretched

        # Overwrite the current file with pitch-shifted audio
        sf.write(CURRENT_FILE_PATH, y, sr)
        
    except Exception as e:
        raise Exception(f"Error pitch shifting audio: {str(e)}")
