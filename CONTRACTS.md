# CONTRACTS.md // HAWKEYE (BOUNTYCAM) AI BRAIN LOCK & SOURCE OF TRUTH
**Zero-Cloud 12-Hour CCTV Forensics & Decentralized Bounty Search Engine**
*Target Systems: NVIDIA GeForce RTX 4070 (8GB VRAM) & NVIDIA GeForce RTX 3050 (4GB VRAM)*

---

## 1. PROJECT OVERVIEW & THE 4-STAGE CASCADING SIEVE ARCHITECTURE

HawkEye (BountyCam) processes up to 12 hours of raw surveillance footage in minutes on local hardware without cloud video streaming. All video decoding, object tracking, vector embedding, and spatial geometry remain 100% on the local host machine.

```
+-----------------------------------------------------------------------------------------+
|                                HAWKEYE PIPELINE CORE                                    |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [ RAW 12-HR CCTV MP4/MKV ]                                                             |
|             │                                                                           |
|             ▼                                                                           |
|   ┌────────────────────────────────────────────────────────────────────────┐            |
|   │ STAGE 1: Keyframe & Motion Sieve (PyAV)                                │            |
|   │ - stream.codec_context.skip_frame = "NONKEY" (evaluates ~2s keyframes) │            |
|   │ - Low-res 160x90 frame-subtraction matrix via OpenCV                   │            |
|   │ - Instantly drops 85% to 98% of empty/static footage with 0 GPU load   │            |
|   │ - Motion Wake-Up Burst: if pixel diff > 1.0%, decode next 3s @ 5-10fps │            |
|   └───────────────────────────────┬────────────────────────────────────────┘            |
|                                   │ Active Motion Burst Frames                          |
|                                   ▼                                                     |
|   ┌────────────────────────────────────────────────────────────────────────┐            |
|   │ STAGE 2: Batched YOLOv8n / YOLO11n + ByteTrack                         │            |
|   │ - Target classes: Person, Two-Wheeler (Bicycle/Motorcycle), Car, Bag   │            |
|   │ - 50x50px Minimum Area Filter + 15% Context Padding                    │            |
|   │ - Sharpest Crop Selection via Laplacian Variance                       │            |
|   │ - Deduplicates tracklets: exactly 1 optimal crop per unique track_id   │            |
|   └───────────────────────────────┬────────────────────────────────────────┘            |
|                                   │ Deduplicated Sharp Crops                            |
|                                   ▼                                                     |
|   ┌────────────────────────────────────────────────────────────────────────┐            |
|   │ STAGE 3: Multimodal Vector Embedding (SigLIP Base)                     │            |
|   │ - google/siglip-base-patch16-224 (768-dim float32 vectors)             │            |
|   │ - In-Memory FAISS Vector Index (IndexFlatIP / IndexIVF)                │            |
|   │ - Metadata store: track_id, camera_id, timestamp_sec, bbox, crop_url   │            |
|   │ - Sub-second natural language and visual photo-to-crop search          │            |
|   └───────────────────────────────┬────────────────────────────────────────┘            |
|                                   │ Top 5-10 Candidate Crops                            |
|                                   ▼                                                     |
|   ┌────────────────────────────────────────────────────────────────────────┐            |
|   │ STAGE 4: Gemini Flash Precision Verifier                               │            |
|   │ - Calls gemini-2.5-flash ONLY on the Top 5 matched image crops         │            |
|   │ - OCR license plates, exact clothing/bag logo & color confirmation     │            |
|   │ - Zero-hallucination verification score + offline fallback support     │            |
|   └────────────────────────────────────────────────────────────────────────┘            |
+-----------------------------------------------------------------------------------------+
```

---

## 2. STRICT HARDWARE-ALIGNED FILE OWNERSHIP RULES

To eliminate context drift, file overwrites, and merge conflicts when two team members and their respective AI agents work in parallel on separate machines, file ownership is strictly enforced:

### Member 1: Team Leader Track (RTX 4070 8GB VRAM)
* **Focus Area:** Core Vision Sieve, Video Ingestion, ByteTrack, SigLIP Vector Search, HTML5 Video Player, and Gemini Flash Verifier.
* **Allowed Edit Scope:**
  - `backend/engine/*` (e.g., `backend/engine/sieve_pipeline.py`, `backend/engine/gemini_verifier.py`)
  - `frontend/src/components/member1_core/*` (e.g., `IngestionTelemetry.tsx`, `SearchAndPlayer.tsx`)
* **Prohibited Edit Scope:** Cannot modify files in `backend/spatial/*` or `frontend/src/components/member2_spatial/*`.

### Member 2: Teammate Track (RTX 3050 4GB VRAM)
* **Focus Area:** Spatial Math, Polygon Tripwire (Shapely), Multi-Camera Escape Map (Leaflet), 60s Video Synopsis (MOG2 alpha feathering), Bounty Mesh, and SHA-256 Forensic Dossier Exporter.
* **Allowed Edit Scope:**
  - `backend/spatial/*` (e.g., `backend/spatial/tripwire_math.py`, `backend/spatial/synopsis_gen.py`, `backend/spatial/dossier_hash.py`)
  - `frontend/src/components/member2_spatial/*` (e.g., `PolygonTripwireCanvas.tsx`, `MultiCamEscapeMap.tsx`, `SynopsisAndDossier.tsx`)
* **Prohibited Edit Scope:** Cannot modify files in `backend/engine/*` or `frontend/src/components/member1_core/*`.

### Locked Shared Contract Files (READ-ONLY After Foundation)
Neither Member 1 nor Member 2 (nor their AI assistants) may rename, delete, or alter the schema fields in these locked files without explicit Team Leader authorization:
1. `backend/schemas.py`
2. `frontend/src/types/contract.ts`
3. `shared_mock_data/sample_tracklets.json`

---

## 3. ALL 4 MANDATORY FLAW MITIGATIONS (MUST BE PRESERVED IN CODE)

Every implementation must adhere to these algorithmic safeguards:

1. **Fix 1: Motion Wake-Up Burst (Prevents Tracker Traps):**
   - Keyframe skipping alone drops fast targets moving between 2-second I-frames.
   - *Rule:* Use keyframes only to inspect background difference. When the `160x90` low-res difference matrix exceeds `1.0%`, dynamically decode the next `3.0 seconds` at `5–10 FPS` to feed `ByteTrack` continuous bounding boxes, then safely return to keyframe skipping.

2. **Fix 2: 50x50px Filter + 15% Context Padding (Prevents Background Hallucinations):**
   - Distant background noise (shadows, distant trees, small artifacts) produces garbage embeddings.
   - *Rule:* Immediately discard any detection where `(x2 - x1) * (y2 - y1) < 2500` pixels. Expand valid detection crops by `15%` padding on all 4 borders to preserve helmets, backpacks, apparel, and vehicle context for SigLIP.

3. **Fix 3: Foreground Motion Masking + Neon HUD Tags (Prevents Ugly Synopsis Boxes):**
   - Slicing and pasting rectangular video patches creates overlapping, ugly, occluded boxes.
   - *Rule:* In `synopsis_gen.py`, extract foreground silhouettes using `cv2.createBackgroundSubtractorMOG2()` with 5px Gaussian alpha feathering. Overlay non-conflicting neon HUD tags: `[ID #42 | 03:14:09 | 38 km/h]`.

4. **Fix 4: Auto IR Night-Mode Detector (Prevents Night-Vision Color Blindness):**
   - Surveillance IR night vision destroys color channels, rendering queries like "red jacket" invalid.
   - *Rule:* Convert sampled frames to HSV and compute mean Saturation ($S$). If $S < 15$, set `is_ir_night_mode = True`, render the `🌙 IR Night Mode Detected` UI badge, and prioritize morphology and vehicle class over color tokens.

---

## 4. HARDWARE VRAM AUTO-SCALING SPECIFICATION

To ensure seamless operation on both the RTX 4070 (8GB) and RTX 3050 (4GB):
```python
import torch

def get_hardware_batch_size() -> int:
    if not torch.cuda.is_available():
        return 8 # CPU fallback
    total_vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    if total_vram_gb >= 7.0:
        return 64 # RTX 4070 / 3070+ (8GB+)
    elif total_vram_gb >= 3.5:
        return 16 # RTX 3050 / 2060 (4GB-6GB)
    else:
        return 8
```
All batch processing loops in `backend/engine/sieve_pipeline.py` must use this dynamic scaling.
