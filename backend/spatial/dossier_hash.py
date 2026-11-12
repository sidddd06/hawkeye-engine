"""
backend/spatial/dossier_hash.py
Member 2 Track (RTX 3050 Spatial & Dossier Engine)
Court-Admissible SHA-256 Forensic Dossier Exporter
"""

import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any
from backend.schemas import DossierReport, TrackletRecord


def generate_dossier(track_id: int) -> DossierReport:
    """
    Constructs a court-admissible forensic dossier certified by a composite SHA-256 seal:
      SHA256(TrackID + CameraID + RawFrameHash + TrajectoryPoints + VerificationTimestamp)
    """
    base_dir = Path(__file__).resolve().parent.parent.parent
    seed_path = base_dir / "shared_mock_data" / "sample_tracklets.json"

    matched_record = None
    if seed_path.exists():
        with open(seed_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                if item.get("track_id") == track_id:
                    matched_record = TrackletRecord(**item)
                    break

    now_utc = datetime.now(timezone.utc).isoformat()

    if matched_record:
        # Construct composite cryptographic chain-of-custody string
        trajectory_str = ";".join([f"{pt.timestamp_sec}:{pt.cx},{pt.cy}" for pt in matched_record.trajectory])
        chain_of_custody_payload = (
            f"CASE:HAWKEYE-FORENSIC-2026|"
            f"TRACK:{matched_record.track_id}|"
            f"CAMERA:{matched_record.camera_id}|"
            f"START:{matched_record.start_time_sec}|"
            f"END:{matched_record.end_time_sec}|"
            f"FRAME_HASH:{matched_record.sha256_frame_hash}|"
            f"TRAJECTORY:{trajectory_str}|"
            f"TIMESTAMP:{now_utc}"
        )
        composite_evidence_hash = hashlib.sha256(chain_of_custody_payload.encode("utf-8")).hexdigest()

        start_min = int(matched_record.start_time_sec // 60)
        start_sec = int(matched_record.start_time_sec % 60)
        end_min = int(matched_record.end_time_sec // 60)
        end_sec = int(matched_record.end_time_sec % 60)
        time_range = f"{start_min:02d}:{start_sec:02d} -> {end_min:02d}:{end_sec:02d}"

        return DossierReport(
            track_id=matched_record.track_id,
            camera_id=matched_record.camera_id,
            sha256_evidence_hash=composite_evidence_hash,
            timestamp_range=time_range,
            best_crop_url=matched_record.crop_url,
            gemini_verification=matched_record.gemini_verification,
            trajectory_points_count=len(matched_record.trajectory),
            generated_at_utc=now_utc,
        )

    # Fallback for unindexed tracklet
    dummy_payload = f"HAWKEYE:UNINDEXED_TRACK:{track_id}:{now_utc}"
    fallback_hash = hashlib.sha256(dummy_payload.encode("utf-8")).hexdigest()
    return DossierReport(
        track_id=track_id,
        camera_id="CAM_01_GATE",
        sha256_evidence_hash=fallback_hash,
        timestamp_range="00:00 -> 00:00",
        best_crop_url="/mock_crops/track_101.jpg",
        gemini_verification="UNINDEXED: Target ID not found in current metadata index.",
        trajectory_points_count=0,
        generated_at_utc=now_utc,
    )
