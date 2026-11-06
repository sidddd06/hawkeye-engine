"""
backend/main.py
Lead Software Architect - HawkEye / BountyCam
FastAPI Backend Gateway connecting Member 1 (Engine) and Member 2 (Spatial)
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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

# Enable permissive CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.post("/api/index", response_model=SieveTelemetry)
def index_video(req: IndexVideoRequest):
    """Executes the 4-Stage Cascading Sieve on raw surveillance video."""
    return sieve_pipeline.start_indexing(video_path=req.video_path, camera_id=req.camera_id)


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
