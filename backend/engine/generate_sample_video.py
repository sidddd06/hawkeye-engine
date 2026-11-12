"""
backend/engine/generate_sample_video.py
Generates a realistic forensic CCTV test video (sample_cctv_feed.mp4)
to benchmark the 4-Stage Cascading Sieve and all 4 mandatory mitigations.
"""

import os
import cv2
import numpy as np
from pathlib import Path


def generate_forensic_sample_video():
    base_dir = Path(__file__).resolve().parent.parent.parent
    output_dir = base_dir / "shared_mock_data"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "sample_cctv_feed.mp4"

    fps = 30
    duration_sec = 24
    total_frames = fps * duration_sec
    width, height = 1280, 720

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

    print(f"Generating forensic CCTV feed: {output_path} ({total_frames} frames)...")

    for i in range(total_frames):
        t_sec = i / fps

        # Night IR mode during seconds 18-24 (saturation < 10)
        is_night = t_sec >= 18.0

        if not is_night:
            # Daytime street background
            frame = np.full((height, width, 3), (35, 45, 55), dtype=np.uint8)
            # Road
            cv2.rectangle(frame, (0, 380), (width, height), (50, 50, 55), -1)
            # Road markings
            for rx in range(0, width, 120):
                cv2.rectangle(frame, (rx, 540), (rx + 60, 550), (220, 220, 220), -1)
            # Sidewalk
            cv2.rectangle(frame, (0, 300), (width, 380), (70, 75, 80), -1)
            # Gate fence
            for fx in range(0, width, 40):
                cv2.line(frame, (fx, 200), (fx, 300), (90, 95, 100), 2)
        else:
            # Monochrome IR Night Vision (Monochrome / greenish-gray)
            frame = np.full((height, width, 3), (25, 30, 25), dtype=np.uint8)
            cv2.rectangle(frame, (0, 380), (width, height), (35, 40, 35), -1)
            for rx in range(0, width, 120):
                cv2.rectangle(frame, (rx, 540), (rx + 60, 550), (120, 130, 120), -1)
            cv2.rectangle(frame, (0, 300), (width, 380), (45, 50, 45), -1)
            for fx in range(0, width, 40):
                cv2.line(frame, (fx, 200), (fx, 300), (60, 70, 60), 2)

        # Static periods: 0-6s (Empty street - Stage 1 sieve discards this)
        # Event 1: High-Speed Red Motorcycle Crossing (6.0s to 11.0s)
        if 6.0 <= t_sec <= 11.0:
            progress = (t_sec - 6.0) / 5.0
            obj_x = int(50 + progress * (width - 250))
            obj_y = int(460 - progress * 40)
            # Red motorcycle body
            cv2.rectangle(frame, (obj_x, obj_y), (obj_x + 130, obj_y + 80), (20, 20, 210), -1)
            # Wheels
            cv2.circle(frame, (obj_x + 25, obj_y + 80), 22, (20, 20, 20), -1)
            cv2.circle(frame, (obj_x + 105, obj_y + 80), 22, (20, 20, 20), -1)
            # Rider torso & Blue Backpack
            cv2.circle(frame, (obj_x + 65, obj_y - 20), 18, (180, 150, 120), -1)  # Head / Helmet
            cv2.rectangle(frame, (obj_x + 50, obj_y - 5), (obj_x + 85, obj_y + 40), (25, 25, 180), -1)  # Red jacket
            cv2.rectangle(frame, (obj_x + 35, obj_y), (obj_x + 55, obj_y + 35), (200, 100, 20), -1)  # Blue backpack
            cv2.putText(frame, "UP-16-EK-9482", (obj_x + 15, obj_y + 60), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        # Event 2: Pedestrian with Black Duffel Bag Walking (12.0s to 17.0s)
        elif 12.0 <= t_sec <= 17.0:
            progress = (t_sec - 12.0) / 5.0
            ped_x = int(width - 150 - progress * (width - 300))
            ped_y = int(320 + progress * 20)
            # Person head & body
            cv2.circle(frame, (ped_x + 25, ped_y), 15, (190, 160, 130), -1)
            cv2.rectangle(frame, (ped_x + 10, ped_y + 15), (ped_x + 40, ped_y + 90), (140, 60, 30), -1)  # Blue coat
            # Black duffel bag
            cv2.rectangle(frame, (ped_x + 38, ped_y + 55), (ped_x + 75, ped_y + 85), (15, 15, 15), -1)

        # Event 3: Night Intruder Scaling Perimeter Fence (19.0s to 24.0s)
        elif 19.0 <= t_sec <= 24.0:
            progress = (t_sec - 19.0) / 5.0
            sus_x = int(800 - progress * 250)
            sus_y = int(220 + progress * 80)
            # Night monochrome silhouette
            cv2.circle(frame, (sus_x + 20, sus_y), 14, (160, 170, 160), -1)
            cv2.rectangle(frame, (sus_x + 8, sus_y + 14), (sus_x + 32, sus_y + 85), (100, 110, 100), -1)
            # Reflective shoes
            cv2.rectangle(frame, (sus_x + 5, sus_y + 85), (sus_x + 18, sus_y + 92), (220, 230, 220), -1)
            cv2.rectangle(frame, (sus_x + 22, sus_y + 85), (sus_x + 35, sus_y + 92), (220, 230, 220), -1)

        # Surveillance OSD Overlay
        cv2.putText(
            frame,
            f"CAM_01_GATE [REC] // {t_sec:05.2f}s // 30 FPS",
            (30, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 180) if not is_night else (180, 220, 180),
            2,
        )

        out.write(frame)

    out.release()
    print("Forensic video generated successfully!")


if __name__ == "__main__":
    generate_forensic_sample_video()
