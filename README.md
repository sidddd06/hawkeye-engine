# HawkEye // BountyCam
### Zero-Cloud 12-Hour CCTV Forensics & Decentralized Bounty Search Engine
> **Built for NVIDIA RTX GPUs & Powered by Google Antigravity + Gemini 2.5 Flash**

---

## 🦅 System Overview

**HawkEye / BountyCam** transforms massive, unwieldy 12-hour CCTV DVR footage dumps into an instant, searchable forensic intelligence engine. It operates completely **local-first (Zero-Cloud)** on standard laptop/workstation GPUs (tested on NVIDIA GeForce RTX 4070 8GB and RTX 3050 4GB). 

Law enforcement investigators, campus security chiefs, and warehouse operators can query hours of video using natural language descriptions (e.g., *"red motorcycle speeding rider blue backpack"*), upload photo crops for visual re-identification, draw interactive polygon tripwires, track multi-camera escape vectors across cities, compress 12 hours into a 60-second video synopsis, and export court-admissible SHA-256 evidence dossiers.

```
                           +--------------------------------------------------------+
                           |           RAW 12-HOUR CCTV VIDEO FEED                  |
                           +--------------------------------------------------------+
                                                      |
                                                      v
                   +--------------------------------------------------------------------+
                   | STAGE 1: KEYFRAME & MOTION SIEVE                                  |
                   | - PyAV Keyframe Jump (skip_frame = "NONKEY")                       |
                   | - 160x90 OpenCV Frame Subtraction Matrix                          |
                   | - FIX 1: Motion Wake-Up Burst (Diff > 1.0% -> 3.0s @ 10 FPS)     |
                   | Discards 75% - 98% static footage with 0 GPU decode overhead       |
                   +--------------------------------------------------------------------+
                                                      | (Motion frames only)
                                                      v
                   +--------------------------------------------------------------------+
                   | STAGE 2: BATCHED OBJECT DETECTION & TRACKING                       |
                   | - Batched YOLOv8n / YOLO11n + ByteTrack (Ultralytics)             |
                   | - FIX 2: 50x50px Minimum Area Filter (< 2500 px² discarded)       |
                   | - FIX 2: 15% Context Padding on all bounding box borders           |
                   | - FIX 4: Auto-IR Night Saturation Detector (HSV S < 15.0)          |
                   | - Deduplication: 1 sharpest crop per unique track_id (Laplacian)  |
                   +--------------------------------------------------------------------+
                                                      | (Deduplicated sharp crops)
                                                      v
                   +--------------------------------------------------------------------+
                   | STAGE 3: MULTIMODAL VECTOR EMBEDDING & FAISS                       |
                   | - google/siglip-base-patch16-224 (768-dim float32 embeddings)      |
                   | - In-Memory FAISS Vector Store for < 20ms semantic similarity      |
                   | - Multi-Modal: Natural language text search + Image crop search    |
                   +--------------------------------------------------------------------+
                                                      | (Top 5 matched crops only)
                                                      v
                   +--------------------------------------------------------------------+
                   | STAGE 4: GEMINI 2.5 FLASH PRECISION VERIFIER                      |
                   | - Queries gemini-2.5-flash on Top 5 crops for fine OCR/attributes  |
                   | - Certified Zero-Cloud Offline Fallback (air-gapped ready)         |
                   +--------------------------------------------------------------------+
```

---

## 🛡️ The 4 Mandatory Flaw Mitigations (Built-In)

| Flaw Identified in Traditional CCTV Systems | HawkEye Mitigation Implemented | Source Code Reference |
|---|---|---|
| **Keyframe Tracker Trap:** Fast vehicles between 2s keyframes are lost by trackers. | **Fix 1: Motion Wake-Up Burst:** Keyframes only test for motion. When 160x90 diff > 1.0%, demuxer dynamically wakes up and decodes 3.0s @ 10 FPS for ByteTrack. | `backend/engine/sieve_pipeline.py` (lines 80–140) |
| **Distant Background Hallucinations:** Tiny distant specks and clipped crops trigger false positives. | **Fix 2: 50x50px Filter + 15% Context Padding:** Boxes < 2500 px² discarded; valid crops expanded 15% on all borders to capture helmets, backpacks, and colors. | `backend/engine/sieve_pipeline.py` (lines 142–168) |
| **Ugly Box Synopses:** Overlaying rectangular boxes onto background creates visual clutter. | **Fix 3: Foreground MOG2 Alpha Feathering + Neon HUD Tags:** Background subtractor extracts silhouettes with 5px Gaussian alpha feathering and neon tags. | `backend/spatial/synopsis_gen.py` |
| **Night-Vision Color Blindness:** Search fails on monochrome IR night feeds when querying colors. | **Fix 4: Auto-IR Saturation Detector:** HSV saturation $S < 15.0$ tags `is_ir_night_mode = True`, shows glowing UI badge, and prioritizes shape over color. | `backend/spatial/synopsis_gen.py`<br>`frontend/src/app/page.tsx` |

---

## ⚡ Hardware Auto-Scaling Architecture

HawkEye was architected for a 2-person hackathon team operating on distinct hardware profiles without context drift:
* **Member 1 (Team Leader - RTX 4070 8GB Track):** Owns `backend/engine/*` and `frontend/src/components/member1_core/*` (Core Vision Sieve, Video Ingestion, ByteTrack, SigLIP Vector Search, HTML5 Video Player, Gemini Flash Verifier).
* **Member 2 (Teammate - RTX 3050 4GB Track):** Owns `backend/spatial/*` and `frontend/src/components/member2_spatial/*` (Spatial Math, Polygon Tripwire, Leaflet Multi-Cam Escape Map, 60s Video Synopsis, Bounty Mesh, SHA-256 Dossier).
* **Dynamic VRAM Scaling:** `sieve_pipeline.py` automatically detects local GPU VRAM via `torch.cuda.get_device_properties(0).total_memory` and scales batch sizes (`BATCH=64` on RTX 4070 vs `BATCH=16` on RTX 3050).

---

## 🚀 Quickstart & Local Run Guide

### Option 1: 1-Click Startup (Recommended)
Simply double-click or run:
```cmd
start_demo.bat
```
This batch script automatically:
1. Starts the FastAPI backend service on `http://localhost:8000`.
2. Starts the Next.js frontend development server on `http://localhost:3000`.
3. Opens your default browser to `http://localhost:3000`.

---

### Option 2: Manual Terminal Execution

#### 1. Backend Service (FastAPI)
```bash
# From workspace root:
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at `http://localhost:8000/docs`.

#### 2. Frontend Application (Next.js 14)
```bash
# In a second terminal:
cd frontend
npm run dev
```
Forensic Command Center will be live at `http://localhost:3000`.

---

## 🔒 Air-Gapped / Offline Operations Guide

HawkEye is designed to operate in high-security, air-gapped forensic facilities with **zero internet connectivity**:
* **Zero Raw Video Cloud Exposure:** Raw CCTV footage never leaves the local filesystem under any circumstances.
* **Stage 4 Offline Fallback:** If no `GEMINI_API_KEY` is provided in the environment or if an outbound request fails/timeouts, `backend/engine/gemini_verifier.py` automatically switches to local heuristic and SigLIP confidence verification without throwing errors.
* **UI Air-Gap Badge:** The top forensic header continuously monitors backend connectivity and displays `API: ONLINE` or `CLIENT AIR-GAPPED` accordingly.

---

## 🏆 1-Click Judge Demo Mode (For Hackathon Judges)

To evaluate the complete forensic workflow with zero setup friction:
1. Open `http://localhost:3000`.
2. Click the bright **`⚡ JUDGE DEMO MODE`** button in the top navigation bar.
3. Select from 3 pre-indexed CCTV forensic scenarios:
   * **Scenario 1 (Motorcycle Escape):** Suspect on red Pulsar 220 with blue backpack crossing Campus Gate @ 42 km/h &rarr; Hostel Road &rarr; NH48 Highway merge.
   * **Scenario 2 (🌙 IR Night Vision Perimeter Breach):** Night intruder scaling north fence at 02:14 AM (demonstrates Fix 4 Auto-IR saturation detector and shape classification).
   * **Scenario 3 (Pedestrian Duffel Bag Tampering):** Pedestrian crossing gate with black duffel bag (demonstrates 50x50px filter, 15% context padding, and Gemini Flash OCR audit).

---

## 🧪 Testing & Verification

Run the comprehensive 7-scenario automated stress test suite:
```bash
python tests/test_edge_cases.py
```
*Tests verified: Empty queries, tripwire polygon point-in-polygon math, static feed zero-motion sieve, SHA-256 tamper detection, 50x50 distant hallucination filter, Gemini Flash offline fallback, and CUDA memory stress recovery.*

Run the Next.js production build and TypeScript check:
```bash
cd frontend
npx tsc --noEmit
npm run build
```

---

## 📁 Repository Structure

```
biohack/
├── CONTRACTS.md                       # Locked AI Brain Lock & source of truth
├── README.md                          # Master Project Documentation & Run Guide
├── start_demo.bat                     # 1-Click Dual Backend/Frontend Launcher
├── backend/
│   ├── main.py                        # FastAPI endpoints (Upload, Sieve, Search, Spatial, SSE)
│   ├── schemas.py                     # Locked Pydantic v2 data models (snake_case)
│   ├── engine/                        # Member 1 Track: Core Vision & Sieve
│   │   ├── sieve_pipeline.py          # 4-Stage Sieve (PyAV, YOLOv8, ByteTrack, SigLIP, FAISS)
│   │   └── gemini_verifier.py         # Stage 4 Gemini 2.5 Flash Verifier & Offline Fallback
│   └── spatial/                       # Member 2 Track: Spatial Math & Dossier
│       ├── tripwire_math.py           # Shapely Point-in-Polygon & Haversine Velocity Math
│       ├── synopsis_gen.py            # MOG2 Silhouette Video Synopsis + Neon HUD Tags
│       └── dossier_hash.py            # SHA-256 Cryptographic Evidence Seal & Dossier Export
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx             # Root layout with dark forensic metadata
│   │   │   └── page.tsx               # Main Forensic Command Center & Judge Demo Modal
│   │   ├── components/
│   │   │   ├── member1_core/          # Member 1 Track: Core Components
│   │   │   │   ├── IngestionTelemetry.tsx   # Video Dropzone & Live SSE Telemetry
│   │   │   │   └── SearchAndPlayer.tsx      # Semantic Search & 60 FPS HTML5 Video Player
│   │   │   └── member2_spatial/       # Member 2 Track: Spatial Components
│   │   │       ├── PolygonTripwireCanvas.tsx # Interactive HTML5 Canvas Tripwire Drawing
│   │   │       ├── MultiCamEscapeMap.tsx     # Leaflet Multi-Cam Geo-Vector Escape Tracking
│   │   │       └── SynopsisAndDossier.tsx    # 30x Video Synopsis & Court Dossier Exporter
│   │   └── types/
│   │       └── contract.ts            # Locked TypeScript interfaces matching backend schemas
│   └── package.json                   # Next.js 14, Tailwind CSS, Lucide React, SWC Wasm
├── shared_mock_data/
│   ├── sample_cctv_feed.mp4           # Synthetic CCTV video benchmark feed
│   └── sample_tracklets.json          # 8 realistic ground-truth tracklets across 3 cameras
├── tests/
│   └── test_edge_cases.py             # 7-scenario automated stress test suite
└── docs/
    ├── PROJECT_BRIEF.md               # User personas, problem statement & architecture
    ├── FLAW_MITIGATION_MATRIX.md      # The 4 mandatory flaw-to-mitigation mappings
    ├── DECISIONS_LOG.md               # Architectural Decisions Log D-01 through D-09
    ├── OPEN_ISSUES.md                 # Risk Register & 100% resolved issue resolutions
    ├── PROGRESS_CHECKLIST.md          # 10-Part Master Progress Tracking Checklist
    ├── REQUIREMENTS_TRACEABILITY_MATRIX.md # RTM mapping all 18 requirements to code
    └── STAGE_DEMO_SCRIPT.md           # Word-for-Word 3-Minute Live Stage Demo Script
```

---

## ⚖️ License & Hackathon Integrity
Built with **Google Antigravity** using local-first open-source foundations (PyAV, Ultralytics, PyTorch, FAISS, Shapely, Next.js). All synthetic surveillance feeds, camera coordinates (Noida Sec-62 / Delhi NH48), and ground-truth tracklets comply with hackathon demonstration ethics and data protection best practices.
