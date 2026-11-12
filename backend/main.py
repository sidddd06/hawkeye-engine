"""
backend/main.py
Lead Software Architect - HawkEye / BountyCam
FastAPI Backend Gateway connecting Member 1 (Engine) and Member 2 (Spatial)
Includes Real-Time SSE Telemetry Streaming & File Upload Ingestion
"""

import os
import shutil
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sse_starlette.sse import EventSourceResponse

from backend.schemas import (
    HealthResponse,
    SieveTelemetry,
    TextSearchQuery,
    SearchResponse,
    TrackletRecord,
    TripwireQuery,
    TripwireResult,
    EscapeMapResponse,
    SynopsisRequest,
    SynopsisResponse,
    DossierReport,
    IndexVideoRequest,
)
from backend.engine.sieve_pipeline import sieve_pipeline
from backend.engine.gemini_verifier import gemini_verifier
from backend.spatial.tripwire_math import check_tripwire, calculate_escape_map
from backend.spatial.synopsis_gen import generate_synopsis
from backend.spatial.dossier_hash import generate_dossier


app = FastAPI(
    title="HawkEye // BountyCam CCTV Forensics API",
    version="1.0.0",
    description="Zero-Cloud 12-Hour CCTV Forensics & Multimodal Search Engine",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload directory
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "shared_mock_data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/api/health", response_model=HealthResponse)
def get_health():
    """System health, GPU telemetry, and tracklet status."""
    return HealthResponse(
        status="ONLINE",
        gpu_device_name=sieve_pipeline.gpu_name,
        gpu_vram_gb=sieve_pipeline.vram_gb,
        loaded_tracklets_count=len(sieve_pipeline.get_all_tracklets()),
        system_time=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/api/telemetry", response_model=SieveTelemetry)
def get_telemetry():
    """Returns real-time 4-Stage Cascading Sieve telemetry counters."""
    return sieve_pipeline.get_telemetry()


@app.get("/api/telemetry/stream")
async def stream_telemetry():
    """Streams live frame counters, discarding ratios, and GPU status via SSE."""
    async def event_generator():
        while True:
            telemetry = sieve_pipeline.get_telemetry()
            yield {
                "event": "telemetry",
                "data": telemetry.model_dump_json()
            }
            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@app.post("/api/index", response_model=SieveTelemetry)
def index_video(req: IndexVideoRequest):
    """Executes the 4-Stage Cascading Sieve on raw surveillance video."""
    return sieve_pipeline.start_indexing(video_path=req.video_path, camera_id=req.camera_id)


@app.post("/api/upload")
async def upload_and_index_video(
    file: UploadFile = File(...),
    camera_id: str = Form("CAM_01_GATE")
):
    """Uploads a local CCTV video file and triggers the 4-stage cascading sieve."""
    saved_path = UPLOAD_DIR / file.filename
    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Mirror to frontend public directory for instant direct static playback
    public_upload_dir = Path(__file__).resolve().parent.parent / "frontend" / "public" / "uploads"
    try:
        public_upload_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy(str(saved_path), str(public_upload_dir / file.filename))
    except Exception:
        pass

    telemetry = sieve_pipeline.process_video_feed(str(saved_path), camera_id=camera_id)
    all_tracklets = sieve_pipeline.get_all_tracklets()
    return {
        "message": "Video successfully uploaded and indexed via 4-Stage Sieve",
        "filename": file.filename,
        "video_url": f"http://localhost:8000/api/video/{file.filename}",
        "tracklets": [t.model_dump() for t in all_tracklets],
        "telemetry": telemetry,
    }


@app.get("/api/video/stream")
def stream_latest_video():
    """Streams the most recently uploaded CCTV video, or falls back to sample feed."""
    upload_files = list(UPLOAD_DIR.glob("*.*"))
    if upload_files:
        latest = max(upload_files, key=lambda p: p.stat().st_mtime)
        return FileResponse(str(latest), media_type="video/mp4")
    sample_path = Path(__file__).resolve().parent.parent / "shared_mock_data" / "sample_cctv_feed.mp4"
    if sample_path.exists():
        return FileResponse(str(sample_path), media_type="video/mp4")
    frontend_sample = Path(__file__).resolve().parent.parent / "frontend" / "public" / "sample_cctv_feed.mp4"
    if frontend_sample.exists():
        return FileResponse(str(frontend_sample), media_type="video/mp4")
    raise HTTPException(status_code=404, detail="No video feed available")


@app.get("/api/video/{filename}")
def stream_video_by_name(filename: str):
    """Streams an uploaded or shared CCTV video by filename."""
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        alt_path = Path(__file__).resolve().parent.parent / "shared_mock_data" / filename
        if alt_path.exists():
            file_path = alt_path
        else:
            public_path = Path(__file__).resolve().parent.parent / "frontend" / "public" / filename
            if public_path.exists():
                file_path = public_path
            else:
                raise HTTPException(status_code=404, detail=f"Video file {filename} not found")
    return FileResponse(str(file_path), media_type="video/mp4")


@app.get("/api/tracklets", response_model=List[TrackletRecord])
def get_all_tracklets():
    """Returns all currently indexed tracklets."""
    return sieve_pipeline.get_all_tracklets()


@app.post("/api/search/text", response_model=SearchResponse)
def search_text(payload: TextSearchQuery):
    """Semantic multimodal search across indexed tracklets."""
    results = sieve_pipeline.search_text(
        query=payload.query,
        top_k=payload.top_k,
        camera_filter=payload.camera_filter,
    )
    return SearchResponse(
        query=payload.query,
        total_matched=len(results),
        results=results,
    )


@app.post("/api/search/image", response_model=SearchResponse)
async def search_image(file: UploadFile = File(...), top_k: int = Form(5)):
    """Visual similarity search using image crop embeddings."""
    content = await file.read()
    results = sieve_pipeline.search_image(file_bytes=content, top_k=top_k)
    return SearchResponse(
        query=f"ImageSearch:{file.filename}",
        total_matched=len(results),
        results=results,
    )


@app.post("/api/tripwire", response_model=TripwireResult)
def evaluate_tripwire(query: TripwireQuery):
    """Evaluates spatial polygon tripwire violations against stored tracklet trajectories."""
    return check_tripwire(
        camera_id=query.camera_id,
        polygon_points=query.polygon_points,
        min_dwell_sec=query.min_dwell_sec,
    )


@app.get("/api/escape-map/{track_id}", response_model=EscapeMapResponse)
def get_escape_map(track_id: int):
    """Computes multi-camera escape vector nodes, trajectory line, and speed estimation."""
    return calculate_escape_map(track_id=track_id)


@app.post("/api/synopsis", response_model=SynopsisResponse)
def get_synopsis(req: SynopsisRequest):
    """Generates condensed video synopsis with foreground alpha feathering and neon HUD tags."""
    return generate_synopsis(
        camera_id=req.camera_id or "CAM_01_GATE",
        target_duration_sec=req.target_duration_sec,
        speedup_factor=req.speedup_factor,
    )


@app.get("/api/dossier/{track_id}", response_model=DossierReport)
def get_dossier(track_id: int):
    """Generates court-admissible forensic dossier with SHA-256 seal."""
    return generate_dossier(track_id=track_id)


# --- Member 2 Spatial Forensics & Synopsis Router ---
from backend.spatial_forensics import router as spatial_forensics_router

app.include_router(spatial_forensics_router)

