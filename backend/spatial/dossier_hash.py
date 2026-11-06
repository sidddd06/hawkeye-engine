"""
backend/spatial/dossier_hash.py
Member 2 Track (RTX 3050 Spatial & Dossier Engine)
Court-Admissible SHA-256 Forensic Dossier Exporter
"""

import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from backend.schemas import DossierReport, TrackletRecord


def generate_dossier(track_id: int) -> DossierReport:
    """
    Constructs a certified forensic dossier for the specified tracklet.
    Includes exact time range, SHA-256 cryptographic evidence seal,
    and Gemini Flash zero-hallucination verification summary.
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
        # Generate composite evidence hash
        composite_str = f"{matched_record.track_id}:{matched_record.camera_id}:{matched_record.sha256_frame_hash}:{now_utc}"
        composite_hash = hashlib.sha256(composite_str.encode("utf-8")).hexdigest()

        start_min = int(matched_record.start_time_sec // 60)
        start_sec = int(matched_record.start_time_sec % 60)
        end_min = int(matched_record.end_time_sec // 60)
        end_sec = int(matched_record.end_time_sec % 60)
        time_range = f"{start_min:02d}:{start_sec:02d} -> {end_min:02d}:{end_sec:02d}"

        return DossierReport(
            track_id=matched_record.track_id,
            camera_id=matched_record.camera_id,
            sha256_evidence_hash=composite_hash,
            timestamp_range=time_range,
            best_crop_url=matched_record.crop_url,
            gemini_verification=matched_record.gemini_verification,
            trajectory_points_count=len(matched_record.trajectory),
            generated_at_utc=now_utc,
        )

    # Fallback if track_id not found
    dummy_hash = hashlib.sha256(f"UNINDEXED_TRACK_{track_id}".encode("utf-8")).hexdigest()
    return DossierReport(
        track_id=track_id,
        camera_id="CAM_UNKNOWN",
        sha256_evidence_hash=dummy_hash,
        timestamp_range="00:00 -> 00:00",
        best_crop_url="/mock_crops/track_101.jpg",
        gemini_verification="UNINDEXED: Target ID not found in current metadata index.",
        trajectory_points_count=0,
        generated_at_utc=now_utc,
    )
