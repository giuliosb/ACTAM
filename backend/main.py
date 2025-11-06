from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import librosa
import soundfile as sf
import os
import uuid

app = FastAPI(title="Music Accompaniment API")

# Allow frontend dev server access (e.g. localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
PROCESSED_DIR = os.path.join(BASE_DIR, "processed")
PRESETS_DIR = os.path.join(BASE_DIR, "presets")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(PRESETS_DIR, exist_ok=True)

# Serve processed files (audio renderings)
app.mount("/processed", StaticFiles(directory=PROCESSED_DIR), name="processed")


# Pydantic models
class TimeStretchRequest(BaseModel):
    filename: str
    rate: float  # Rate: new_bpm / old_bpm


class Preset(BaseModel):
    name: str
    data: dict


# Routes
@app.get("/")
async def root():
    return {"message": "Music Accompaniment Backend is running!"}


@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Invalid file type")

    ext = os.path.splitext(file.filename)[1]
    dest = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, dest)

    with open(file_path, "wb") as f:
        f.write(await file.read())

    return {"filename": dest, "url": f"/uploads/{dest}"}


@app.post("/analyze/bpm")
async def analyze_bpm(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    y, sr = librosa.load(file_path, sr=None)
    bpm, beats = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beats, sr=sr)

    return {"bpm": float(bpm), "beat_times": beat_times.tolist()}


@app.post("/process/time-stretch")
async def time_stretch(req: TimeStretchRequest):
    in_path = os.path.join(UPLOAD_DIR, req.filename)
    if not os.path.exists(in_path):
        raise HTTPException(status_code=404, detail="Input file not found")

    y, sr = librosa.load(in_path, sr=None)
    y_stretched = librosa.effects.time_stretch(y, req.rate)

    out_name = f"{uuid.uuid4().hex}.wav"
    out_path = os.path.join(PROCESSED_DIR, out_name)
    sf.write(out_path, y_stretched, sr)

    return {"processed_file": out_name, "url": f"/processed/{out_name}"}


@app.post("/presets")
async def save_preset(preset: Preset):
    file_path = os.path.join(PRESETS_DIR, preset.name + ".json")
    with open(file_path, "w") as f:
        f.write(preset.data.json())
    return {"message": "Preset saved", "filename": file_path}


@app.get("/presets/{name}")
async def load_preset(name: str):
    file_path = os.path.join(PRESETS_DIR, name + ".json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Preset not found")
    with open(file_path, "r") as f:
        return f.read()
