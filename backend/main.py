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
    file: UploadFile = File(...),
    speed_factor: float = Form(1.0)  # e.g., 0.5 = half speed, 2.0 = double speed
):
    """Receives an audio file and a speed factor, returns time-stretched audio."""

    # Create a temporary directory to safely handle files
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, file.filename)
        output_path = os.path.join(tmpdir, "processed.wav")

        # Save uploaded file
        with open(input_path, "wb") as f:
            f.write(await file.read())

        try:
            # Load audio
            y, sr = librosa.load(input_path, sr=None)

            # Apply time stretch
            if speed_factor <= 0:
                return JSONResponse({"error": "Speed factor must be > 0"}, status_code=400)

            y_stretched = librosa.effects.time_stretch(y, rate=speed_factor)

            # Save processed output
            sf.write(output_path, y_stretched, sr)

            # Return file as downloadable response
            return FileResponse(output_path, filename="processed.wav", media_type="audio/wav")

        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)



@app.post("/clear")
def clear_temp():
    """Delete the current temporary file."""
    global CURRENT_FILE_PATH
    if CURRENT_FILE_PATH and os.path.exists(CURRENT_FILE_PATH):
        os.remove(CURRENT_FILE_PATH)
        CURRENT_FILE_PATH = None
        return {"message": "Temporary file cleared"}
    return {"message": "No file to clear"}


@app.get("/temp/audio")
def get_temp_audio():
    """Get the current temporary audio file"""
    global CURRENT_FILE_PATH
    if CURRENT_FILE_PATH and os.path.exists(CURRENT_FILE_PATH):
        return FileResponse(CURRENT_FILE_PATH, filename="temp.wav", media_type="audio/wav")
    return {"error": "No audio file uploaded yet"}
