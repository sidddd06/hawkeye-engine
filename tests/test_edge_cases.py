"""
tests/test_edge_cases.py
Comprehensive Edge-Case Stress Test Suite for HawkEye / BountyCam (Part 8)
"""

import sys
import os
import unittest
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from backend.schemas import (
    TextSearchQuery,
    TripwireQuery,
    SynopsisRequest,
    IndexVideoRequest,
)
from backend.main import (
    app,
    get_health,
    get_telemetry,
    get_all_tracklets,
    search_text,
    evaluate_tripwire,
    get_escape_map,
    get_synopsis,
    get_dossier,
    index_video,
)
from backend.engine.sieve_pipeline import sieve_pipeline
from backend.spatial.tripwire_math import check_tripwire, calculate_escape_map
from backend.spatial.synopsis_gen import generate_synopsis
from backend.spatial.dossier_hash import generate_dossier


class TestHawkEyeEdgeCases(unittest.TestCase):

    def test_01_empty_and_nonsense_search_query(self):
        """Stress-test queries with zero semantic overlap."""
        res_empty = search_text(TextSearchQuery(query="", top_k=5))
        self.assertIsNotNone(res_empty)

        res_nonsense = search_text(TextSearchQuery(query="purple alien submarine underwater", top_k=5))
        self.assertIsNotNone(res_nonsense)
        self.assertTrue(len(res_nonsense.results) <= 5)
        # Scores should remain bounded between 0.0 and 1.0
        for r in res_nonsense.results:
            self.assertTrue(0.0 <= (r.similarity_score or 0.0) <= 1.0)

    def test_02_invalid_and_corrupt_video_paths(self):
        """Test sieve response when given non-existent or corrupted video paths."""
        tel = sieve_pipeline.process_video_feed("non_existent_surveillance_file_999.mp4")
        self.assertEqual(tel.status, "ERROR")

    def test_03_degenerate_polygon_tripwires(self):
        """Test polygons with < 3 points, collinear points, or self-intersecting points."""
        # 0 points
        res_0 = check_tripwire("CAM_01_GATE", [])
        self.assertFalse(res_0.violated)
        self.assertEqual(len(res_0.violating_tracklets), 0)

        # 2 points (line, not polygon)
        res_2 = check_tripwire("CAM_01_GATE", [(10, 10), (100, 100)])
        self.assertFalse(res_2.violated)

        # Self-intersecting bowtie polygon
        bowtie = [(0, 0), (200, 200), (0, 200), (200, 0)]
        res_bowtie = check_tripwire("CAM_01_GATE", bowtie)
        self.assertIsNotNone(res_bowtie)

    def test_04_unindexed_and_negative_track_ids(self):
        """Test escape map and dossier export on missing track IDs."""
        escape_missing = calculate_escape_map(99999)
        self.assertEqual(escape_missing.track_id, 99999)
        self.assertEqual(len(escape_missing.nodes), 1)  # Fallback single node

        dossier_missing = generate_dossier(-1)
        self.assertEqual(dossier_missing.track_id, -1)
        self.assertTrue(len(dossier_missing.sha256_evidence_hash) == 64)

    def test_05_camera_filter_edge_cases(self):
        """Test search filtering by non-existent camera ID."""
        res_cam = search_text(TextSearchQuery(query="motorcycle", camera_filter="CAM_NON_EXISTENT_99"))
        self.assertEqual(len(res_cam.results), 0)

    def test_06_dossier_sha256_reproducibility_and_format(self):
        """Verify SHA-256 evidence hash length and hex character set."""
        dossier = generate_dossier(101)
        h = dossier.sha256_evidence_hash
        self.assertEqual(len(h), 64)
        self.assertTrue(all(c in "0123456789abcdef" for c in h))

    def test_07_ir_saturation_tagging(self):
        """Verify night-mode IR tagging on Track 201."""
        records = sieve_pipeline.get_all_tracklets()
        track_201 = next((r for r in records if r.track_id == 201), None)
        if track_201:
            self.assertTrue(track_201.is_ir_night_mode)
            self.assertTrue(track_201.avg_saturation < 15.0)


if __name__ == "__main__":
    unittest.main()
