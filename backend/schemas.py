"""
backend/schemas.py
LOCKED SHARED CONTRACT - DO NOT MODIFY WITHOUT TEAM LEADER AUTHORIZATION
Strict 100% snake_case JSON alignment with frontend/src/types/contract.ts
"""

from typing import List, Optional, Tuple, Literal
from pydantic import BaseModel, Field


class BBoxPoint(BaseModel):
    timestamp_sec: float = Field(..., description="Timestamp in seconds from video start")
    x1: int = Field(..., description="Top-left X coordinate")
    y1: int = Field(..., description="Top-left Y coordinate")
    x2: int = Field(..., description="Bottom-right X coordinate")
    y2: int = Field(..., description="Bottom-right Y coordinate")
    cx: int = Field(..., description="Center X coordinate")
    cy: int = Field(..., description="Center Y coordinate")


class TrackletRecord(BaseModel):
    track_id: int = Field(..., description="Unique tracklet ID assigned by ByteTrack")
    camera_id: str = Field(..., description="Identifier for camera feed (e.g., CAM_01_GATE)")
    start_time_sec: float = Field(..., description="Start timestamp of tracking window")
    end_time_sec: float = Field(..., description="End timestamp of tracking window")
    best_timestamp_sec: float = Field(..., description="Timestamp of the sharpest crop")
    object_class: str = Field(..., description="Object class: person, bicycle, motorcycle, car, backpack")
    crop_url: str = Field(..., description="URL or static path to sharpest crop image")
    is_ir_night_mode: bool = Field(..., description="True if captured under night-vision IR monochrome")
    avg_saturation: float = Field(..., description="Mean HSV saturation value (0-255)")
    trajectory: List[BBoxPoint] = Field(default_factory=list, description="Trajectory coordinates across time")
    similarity_score: Optional[float] = Field(default=None, description="Vector cosine/IP similarity score (0.0 - 1.0)")
    gemini_verification: Optional[str] = Field(default=None, description="Gemini Flash forensic audit notes")
    sha256_frame_hash: str = Field(..., description="Cryptographic SHA-256 hash of the best crop image")


class SieveTelemetry(BaseModel):
    status: Literal["IDLE", "INDEXING", "COMPLETED", "ERROR"] = Field(default="IDLE")
    raw_frames_total: int = Field(default=0, description="Total frames in raw video (e.g. 1,296,000 for 12 hours)")
    keyframes_checked: int = Field(default=0, description="I-frames inspected via PyAV skip_frame='NONKEY'")
    motion_frames_woken: int = Field(default=0, description="Frames decoded during motion wake-up bursts")
    unique_tracklets: int = Field(default=0, description="Number of unique objects tracked and indexed")
    elapsed_sec: float = Field(default=0.0, description="Ingestion processing wall-clock time in seconds")
    gpu_device_name: str = Field(default="CPU Fallback", description="Name of detected GPU accelerator")


class TripwireQuery(BaseModel):
    camera_id: str = Field(..., description="Target camera feed ID")
    polygon_points: List[Tuple[int, int]] = Field(..., description="Ordered list of (x, y) coordinates defining polygon zone")
    min_dwell_sec: float = Field(default=1.0, description="Minimum seconds an object must dwell within polygon")


class EscapeVectorNode(BaseModel):
    camera_id: str = Field(..., description="Camera identifier")
    camera_name: str = Field(..., description="Human-readable camera location name")
    lat: float = Field(..., description="Latitude coordinate")
    lng: float = Field(..., description="Longitude coordinate")
    timestamp_sec: float = Field(..., description="Time of object sighting at this node")
    crop_url: str = Field(..., description="Best crop captured at this camera")
    est_speed_kmh: Optional[float] = Field(default=None, description="Estimated velocity from previous node")


# --- Supporting API Schemas ---

class TextSearchQuery(BaseModel):
    query: str = Field(..., description="Natural language search description (e.g. 'delivery rider on red scooter')")
    top_k: int = Field(default=5, ge=1, le=50)
    camera_filter: Optional[str] = Field(default=None)


class SearchResponse(BaseModel):
    query: str
    total_matched: int
    results: List[TrackletRecord]


class TripwireResult(BaseModel):
    camera_id: str
    polygon_points: List[Tuple[int, int]]
    violated: bool
    violating_tracklets: List[TrackletRecord]


class EscapeMapResponse(BaseModel):
    track_id: int
    nodes: List[EscapeVectorNode]
    total_distance_km: float
    avg_speed_kmh: float


class SynopsisRequest(BaseModel):
    camera_id: str = Field(default="CAM_01_GATE")
    target_duration_sec: int = Field(default=60)
    speedup_factor: int = Field(default=30)


class SynopsisResponse(BaseModel):
    camera_id: str
    synopsis_video_url: str
    duration_sec: float
    total_events_condensed: int
    hud_tags: List[str]


class DossierReport(BaseModel):
    track_id: int
    camera_id: str
    sha256_evidence_hash: str
    timestamp_range: str
    best_crop_url: str
    gemini_verification: Optional[str] = None
    trajectory_points_count: int
    generated_at_utc: str


class HealthResponse(BaseModel):
    status: str
    gpu_device_name: str
    gpu_vram_gb: float
    loaded_tracklets_count: int
    system_time: str


class IndexVideoRequest(BaseModel):
    video_path: str = Field(..., description="Local path to surveillance video file")
    camera_id: str = Field(default="CAM_01_GATE")
