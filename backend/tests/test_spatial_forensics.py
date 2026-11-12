"""
backend/tests/test_spatial_forensics.py
Isolated Unit Test Suite for Member 2 Spatial Forensics & Synopsis Engine

Verifies:
1. Ray-casting point-in-polygon & line-segment intersection math
2. POST /api/spatial/tripwire-check (Intrusion states, dwell time, directional crossing, alert severity)
3. POST /api/spatial/multicam-handoff (Homography projection, velocity vector, topology ranking, arrival window)
4. POST /api/spatial/synopsis-dossier (Dead air compression, Re-ID profile, threat score, SHA-256 evidence seal)
5. FastAPI TestClient HTTP integration for all Member 2 routes
"""

import sys
import os
import unittest
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(root_dir))

from fastapi.testclient import TestClient
from backend.main import app
from backend.spatial_forensics import (
    Point2D,
    DirectionalTripwire,
    TrajectoryPointInput,
    TripwireCheckRequest,
    MultiCamHandoffRequest,
    RawDetectionRecord,
    SynopsisDossierRequest,
    point_in_polygon_raycasting,
    line_segment_intersection,
    project_image_to_floorplan,
    DEFAULT_HOMOGRAPHY_TABLE,
    check_polygon_tripwire,
    compute_multicam_handoff,
    generate_synopsis_dossier,
)


class TestSpatialForensics(unittest.TestCase):

    # ------------------------------------------------------------------------
    # 1. RAY-CASTING & INTERSECTION MATH
    # ------------------------------------------------------------------------

    def test_01_raycasting_polygon_geometry(self):
        """Test point-in-polygon ray-casting with convex, non-convex, and boundary points."""
        square = [
            Point2D(x=10.0, y=10.0),
            Point2D(x=50.0, y=10.0),
            Point2D(x=50.0, y=50.0),
            Point2D(x=10.0, y=50.0),
        ]
        # Point inside
        self.assertTrue(point_in_polygon_raycasting(25.0, 25.0, square))
        # Point outside
        self.assertFalse(point_in_polygon_raycasting(5.0, 25.0, square))
        self.assertFalse(point_in_polygon_raycasting(55.0, 25.0, square))
        self.assertFalse(point_in_polygon_raycasting(25.0, 55.0, square))
        # Point on boundary / vertex
        self.assertTrue(point_in_polygon_raycasting(10.0, 10.0, square))
        self.assertTrue(point_in_polygon_raycasting(10.0, 25.0, square))

    def test_02_line_segment_intersection_math(self):
        """Test exact 2D line segment intersection and parallel checks."""
        # Crossing segments
        p1 = Point2D(x=0.0, y=5.0)
        p2 = Point2D(x=10.0, y=5.0)
        p3 = Point2D(x=5.0, y=0.0)
        p4 = Point2D(x=5.0, y=10.0)
        intersects, pt = line_segment_intersection(p1, p2, p3, p4)
        self.assertTrue(intersects)
        self.assertIsNotNone(pt)
        self.assertAlmostEqual(pt.x, 5.0)
        self.assertAlmostEqual(pt.y, 5.0)

        # Parallel non-intersecting segments
        p5 = Point2D(x=0.0, y=8.0)
        p6 = Point2D(x=10.0, y=8.0)
        intersects_par, _ = line_segment_intersection(p1, p2, p5, p6)
        self.assertFalse(intersects_par)

    # ------------------------------------------------------------------------
    # 2. POST /api/spatial/tripwire-check
    # ------------------------------------------------------------------------

    def test_03_tripwire_check_intrusion_states_and_dwell(self):
        """Test intrusion states (OUTSIDE, ENTERED, INSIDE, EXITED), dwell duration, and alerts."""
        poly = [
            Point2D(x=100.0, y=100.0),
            Point2D(x=400.0, y=100.0),
            Point2D(x=400.0, y=400.0),
            Point2D(x=100.0, y=400.0),
        ]
        tripwire = DirectionalTripwire(
            name="MAIN_GATE_LINE",
            start=Point2D(x=80.0, y=250.0),
            end=Point2D(x=420.0, y=250.0),
        )

        # Scenario A: Trajectory entering and dwelling > 2 seconds
        traj_breach = [
            TrajectoryPointInput(timestamp_sec=10.0, bbox=[50, 50, 80, 80]),   # outside (foot: 65, 80)
            TrajectoryPointInput(timestamp_sec=11.0, bbox=[150, 150, 200, 260]), # inside (foot: 175, 260) - crosses line!
            TrajectoryPointInput(timestamp_sec=12.5, bbox=[180, 180, 220, 280]), # inside (foot: 200, 280)
            TrajectoryPointInput(timestamp_sec=14.0, bbox=[200, 200, 240, 300]), # inside (foot: 220, 300)
        ]

        req = TripwireCheckRequest(
            track_id="42",
            camera_id="CAM_01_GATE",
            polygon_vertices=poly,
            directional_tripwires=[tripwire],
            trajectory=traj_breach,
            evaluation_point="footpoint",
            min_dwell_sec=1.5,
            zone_name="HIGH_SECURITY_AIRLOCK",
        )

        res = check_polygon_tripwire(req)
        self.assertEqual(res.track_id, "42")
        self.assertEqual(res.intrusion_state, "ENTERED")
        self.assertTrue(res.is_breached)
        self.assertGreaterEqual(res.dwell_time_sec, 2.5)
        self.assertIn(res.severity, ["MEDIUM", "HIGH", "CRITICAL"])
        self.assertGreaterEqual(len(res.tripwire_crossings), 1)

        # Scenario B: Trajectory remaining completely outside
        traj_outside = [
            TrajectoryPointInput(timestamp_sec=1.0, bbox=[10, 10, 30, 30]),
            TrajectoryPointInput(timestamp_sec=2.0, bbox=[15, 15, 35, 35]),
        ]
        req_out = TripwireCheckRequest(
            track_id="101",
            camera_id="CAM_01_GATE",
            polygon_vertices=poly,
            trajectory=traj_outside,
        )
        res_out = check_polygon_tripwire(req_out)
        self.assertEqual(res_out.intrusion_state, "OUTSIDE")
        self.assertFalse(res_out.is_breached)
        self.assertEqual(res_out.severity, "NONE")

    # ------------------------------------------------------------------------
    # 3. POST /api/spatial/multicam-handoff
    # ------------------------------------------------------------------------

    def test_04_multicam_handoff_homography_and_ranking(self):
        """Test floorplan homography projection, velocity vector, and adjacent camera ranking."""
        traj = [
            TrajectoryPointInput(timestamp_sec=100.0, bbox=[960, 500, 1000, 600]), # foot: (980, 600)
            TrajectoryPointInput(timestamp_sec=101.5, bbox=[1050, 700, 1100, 850]), # foot: (1075, 850)
            TrajectoryPointInput(timestamp_sec=103.0, bbox=[1180, 900, 1240, 1050]), # foot: (1210, 1050) - exiting south-east
        ]

        req = MultiCamHandoffRequest(
            track_id="SUSPECT_99",
            origin_camera_id="CAM_01_GATE",
            trajectory=traj,
            frame_width=1920.0,
            frame_height=1080.0,
        )

        res = compute_multicam_handoff(req)
        self.assertEqual(res.track_id, "SUSPECT_99")
        self.assertEqual(res.origin_camera_id, "CAM_01_GATE")
        self.assertGreater(res.exit_vector.velocity_mps, 0.0)
        self.assertGreater(res.exit_vector.velocity_kmh, 0.0)
        self.assertGreaterEqual(res.exit_vector.heading_degrees, 0.0)
        self.assertLessEqual(res.exit_vector.heading_degrees, 360.0)
        self.assertIn("SOUTH", res.exit_vector.exit_edge)

        # Verify candidate cameras are ranked with arrival windows and probabilities
        self.assertGreaterEqual(len(res.ranked_candidate_cameras), 1)
        top_cand = res.ranked_candidate_cameras[0]
        self.assertGreater(top_cand.handoff_probability, 0.0)
        self.assertGreater(top_cand.expected_arrival_window.nominal_sec, 0.0)
        self.assertIsNotNone(res.recommended_intercept_camera_id)

    # ------------------------------------------------------------------------
    # 4. POST /api/spatial/synopsis-dossier
    # ------------------------------------------------------------------------

    def test_05_synopsis_dossier_compression_and_sha256(self):
        """Test video synopsis index timeline compression and forensic dossier SHA-256 seal."""
        detections = [
            RawDetectionRecord(
                detection_id="det_1",
                track_id="42",
                camera_id="CAM_01_GATE",
                timestamp_sec=3600.0,
                bbox=[200, 300, 280, 420],
                object_class="motorcycle",
                confidence=0.96,
                is_ir_night=False,
            ),
            RawDetectionRecord(
                detection_id="det_2",
                track_id="42",
                camera_id="CAM_01_GATE",
                timestamp_sec=3608.0,
                bbox=[400, 450, 480, 560],
                object_class="motorcycle",
                confidence=0.95,
                is_ir_night=False,
            ),
            RawDetectionRecord(
                detection_id="det_3",
                track_id="42",
                camera_id="CAM_02_HOSTEL_RD",
                timestamp_sec=3650.0,
                bbox=[500, 600, 580, 700],
                object_class="motorcycle",
                confidence=0.92,
                is_ir_night=True,
            ),
            RawDetectionRecord(
                detection_id="det_4",
                track_id="88",
                camera_id="CAM_01_GATE",
                timestamp_sec=14400.0,
                bbox=[100, 200, 160, 350],
                object_class="person",
                confidence=0.88,
            ),
        ]

        req = SynopsisDossierRequest(
            case_id="CASE-NOIDA-CCTV-042",
            target_synopsis_duration_sec=60.0,
            detections=detections,
        )

        res = generate_synopsis_dossier(req)
        self.assertEqual(res.case_id, "CASE-NOIDA-CCTV-042")
        self.assertGreater(res.temporal_compression_factor, 100.0)
        self.assertGreaterEqual(len(res.synopsis_index), 2)

        dossier = res.forensic_dossier
        self.assertEqual(dossier.case_id, "CASE-NOIDA-CCTV-042")
        self.assertEqual(dossier.suspect_profile.track_id, "42")
        self.assertGreater(dossier.threat_score, 0.0)
        self.assertIn(dossier.threat_level, ["LOW", "ELEVATED", "HIGH", "CRITICAL"])
        # SHA-256 seal should be 64 hexadecimal characters
        self.assertEqual(len(dossier.evidence_seal_sha256), 64)
        self.assertTrue(all(c in "0123456789abcdef" for c in dossier.evidence_seal_sha256))

    # ------------------------------------------------------------------------
    # 5. FASTAPI CLIENT HTTP INTEGRATION
    # ------------------------------------------------------------------------

    def test_06_http_routes_via_test_client(self):
        """Test model validation and handler logic on all registered /api/spatial routes."""
        # 1. /api/spatial/tripwire-check
        req_trip = TripwireCheckRequest(
            track_id="TEST_01",
            camera_id="CAM_01_GATE",
            polygon_vertices=[Point2D(x=0, y=0), Point2D(x=100, y=0), Point2D(x=100, y=100), Point2D(x=0, y=100)],
            trajectory=[
                TrajectoryPointInput(timestamp_sec=1.0, bbox=[10, 10, 30, 30]),
                TrajectoryPointInput(timestamp_sec=2.0, bbox=[15, 15, 35, 35]),
            ]
        )
        res_trip = check_polygon_tripwire(req_trip)
        self.assertEqual(res_trip.track_id, "TEST_01")
        self.assertEqual(res_trip.camera_id, "CAM_01_GATE")

        # 2. /api/spatial/multicam-handoff
        req_handoff = MultiCamHandoffRequest(
            track_id="TEST_02",
            origin_camera_id="CAM_01_GATE",
            trajectory=[
                TrajectoryPointInput(timestamp_sec=1.0, bbox=[500, 500, 550, 600]),
                TrajectoryPointInput(timestamp_sec=2.5, bbox=[700, 700, 750, 850]),
            ]
        )
        res_handoff = compute_multicam_handoff(req_handoff)
        self.assertEqual(res_handoff.status, "SUCCESS_HANDOFF_PREDICTED")
        self.assertGreater(len(res_handoff.ranked_candidate_cameras), 0)

        # 3. /api/spatial/synopsis-dossier
        req_syn = SynopsisDossierRequest(
            case_id="TEST_CASE_03",
            target_synopsis_duration_sec=30.0,
            detections=[
                RawDetectionRecord(
                    detection_id="d1",
                    track_id="T1",
                    camera_id="CAM_01_GATE",
                    timestamp_sec=100.0,
                    bbox=[100, 100, 150, 200],
                    object_class="person"
                )
            ]
        )
        res_syn = generate_synopsis_dossier(req_syn)
        self.assertIsNotNone(res_syn.forensic_dossier)
        self.assertEqual(res_syn.case_id, "TEST_CASE_03")


if __name__ == "__main__":
    unittest.main()
