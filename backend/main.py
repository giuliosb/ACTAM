from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
import tempfile
import librosa
import soundfile as sf
import os

app = FastAPI(title="Audio Processor API")

# --- GLOBAL TEMP FILE ---
CURRENT_FILE_PATH = None


@app.get("/")
def root():
    return {"message": "Audio Processor Backend is running!"}


@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """Upload one audio file temporarily."""
    global CURRENT_FILE_PATH

    suffix = os.path.splitext(file.filename)[1]
    temp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    with open(temp.name, "wb") as f:
        f.write(await file.read())

    CURRENT_FILE_PATH = temp.name
    return {"message": "File uploaded successfully", "path": CURRENT_FILE_PATH}


@app.post("/process")
async def process_audio(
    speed_factor: float = Form(1.0),  # e.g., 1.2 = 20% faster
    pitch_shift: float = Form(0.0),   # in semitones (e.g., +2 or -3)
):
    """Process the uploaded file — change speed or pitch."""
    global CURRENT_FILE_PATH
    if not CURRENT_FILE_PATH or not os.path.exists(CURRENT_FILE_PATH):
        return {"error": "No audio file uploaded yet."}

    y, sr = librosa.load(CURRENT_FILE_PATH, sr=None)

    # Apply pitch shift
    if pitch_shift != 0:
        y = librosa.effects.pitch_shift(y, sr, n_steps=pitch_shift)

    # Apply time-stretch
    if speed_factor != 1.0:
        y = librosa.effects.time_stretch(y, rate=speed_factor)

    # Save processed output
    out_path = CURRENT_FILE_PATH.replace(".", "_processed.")
    sf.write(out_path, y, sr)

    return FileResponse(out_path, filename="processed.wav", media_type="audio/wav")



@app.post("/clear")
def clear_temp():
    """Delete the current temporary file."""
    global CURRENT_FILE_PATH
    if CURRENT_FILE_PATH and os.path.exists(CURRENT_FILE_PATH):
        os.remove(CURRENT_FILE_PATH)
        CURRENT_FILE_PATH = None
        return {"message": "Temporary file cleared"}
    return {"message": "No file to clear"}
