# HawkEye / BountyCam - Project Brief
**Zero-Cloud 12-Hour CCTV Forensics & Decentralized Bounty Search Engine**

---

## 1. Executive Overview
HawkEye (BountyCam) is a high-performance, privacy-first CCTV forensic video intelligence engine designed to process up to 12 hours of raw surveillance footage in minutes on local hardware. By leveraging a proprietary **4-Stage Cascading Sieve**, HawkEye eliminates up to 98% of empty footage without heavy pixel decoding, indexes objects into high-dimensional multimodal vector space (SigLIP), and provides sub-second natural language and photo-similarity search with zero-hallucination verification powered by Gemini Flash.

---

## 2. Target User Personas & Core Journeys

### A. RWA (Resident Welfare Association) Security & Society Administrators
* **Operational Environment:** Gated communities, residential towers, suburban developments with 16–64 IP CCTV feeds.
* **Pain Points:** 
  - Stolen bicycles, delivery parcel theft, pet escapes, and hit-and-run parking incidents.
  - Guards spend 4 to 8 hours manually scrubbing low-frame-rate DVR footage on standard 1080p monitors.
* **Core Need:** 
  - Drag-and-drop a multi-hour DVR MP4 export.
  - Search natural queries like *"delivery boy with blue backpack on red scooter"* or upload a phone snapshot of a missing pet.
  - Instant jump to exact timestamp with highlighted bounding boxes.

### B. Warehouse, Logistics & Industrial Operations Managers
* **Operational Environment:** Distribution hubs, cargo bays, inventory staging areas operating 24/7.
* **Pain Points:** 
  - Pallet tampering, cargo shrinkage, safety violations (lack of high-vis vests/helmets), forklift perimeter breaches.
  - Huge storage volume of static footage where 95% of time shows no active motion.
* **Core Need:** 
  - Spatial Polygon Tripwires across high-value bays or hazardous zones.
  - 1-Click Video Synopsis condensing an 8-hour shift into a 60-second accelerated summary with dynamic alpha-feathered silhouettes.
  - Automated detection of movement during off-shift hours.

### C. Law Enforcement & Police Forensic Investigators
* **Operational Environment:** Police stations, crime analytics cells, municipal security centers.
* **Pain Points:** 
  - Collecting CCTV dumps from multiple commercial street shops in varied formats.
  - Tracking a suspect across non-overlapping camera feeds (Multi-Cam Re-ID).
  - Risk of digital evidence tampering or chain-of-custody rejection in court.
* **Core Need:** 
  - Multi-Camera Escape Map tracking chronological trajectory and estimated speed across camera locations.
  - Cryptographic SHA-256 Forensic Dossier export certifying timestamped frames, source hashes, and detection metadata.
  - Gemini Flash precision verifier to confirm specific text, license numbers, and clothing logos with zero hallucination.

---

## 3. High-Level Technical Architecture

```
+-----------------------------------------------------------------------------------------+
|                                HAWKEYE PIPELINE CORE                                    |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [ RAW 12-HR CCTV MP4/MKV ]                                                             |
|             │                                                                           |
|             ▼                                                                           |
|   ┌────────────────────────────────────────────────────────┐                            |
|   │ STAGE 1: Keyframe (I-Frame) & Motion Sieve (PyAV)      │                            |
|   │ - skip_frame = "NONKEY" (evaluates ~every 2.0 sec)     │                            |
|   │ - 160x90 Low-Res Frame Subtraction Matrix              │                            |
|   │ - 85% to 98% static footage dropped with 0 GPU load    │                            |
|   │ - Motion Wake-Up Burst: if diff >1%, decode 3s @ 5-10fps                            |
|   └─────────────────────────┬──────────────────────────────┘                            |
|                             │ Active Motion Burst Frames                                |
|                             ▼                                                           |
|   ┌────────────────────────────────────────────────────────┐                            |
|   │ STAGE 2: Batched YOLOv8n / YOLO11n + ByteTrack         │                            |
|   │ - Classes: Person, Two-Wheeler, Car, Backpack          │                            |
|   │ - 50x50px Minimum Area Filter + 15% Context Padding    │                            |
|   │ - Sharpest Crop Selection (Laplacian variance)         │                            |
|   │ - Deduplicated to 1 optimal crop per Tracklet ID       │                            |
|   └─────────────────────────┬──────────────────────────────┘                            |
|                             │ Deduplicated Quality Crops                                |
|                             ▼                                                           |
|   ┌────────────────────────────────────────────────────────┐                            |
|   │ STAGE 3: Multimodal Vector Embedding (SigLIP Base)     │                            |
|   │ - google/siglip-base-patch16-224 (768-dim float32)     │                            |
|   │ - In-Memory / Disk-Backed FAISS Vector Index           │                            |
|   │ - SQLite Metadata Store (track_id, cam_id, bbox, time) │                            |
|   └─────────────────────────┬──────────────────────────────┘                            |
|                             │ Top 5-10 Candidate Matches                                |
|                             ▼                                                           |
|   ┌────────────────────────────────────────────────────────┐                            |
|   │ STAGE 4: Gemini Flash Precision Verifier               │                            |
|   │ - Direct crop validation via gemini-2.5-flash          │                            |
|   │ - Attribute verification, OCR, confidence scoring      │                            |
|   │ - Zero-hallucination confirmation for critical matches │                            |
|   └─────────────────────────┬──────────────────────────────┘                            |
|                             │                                                           |
|                             ▼                                                           |
|  [ FORENSIC COMMAND CENTER: Search, Player, Tripwire, Escape Map, Synopsis, Dossier ]   |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Key Performance Targets
- **Ingestion Throughput:** Up to 100x realtime playback speed on 12-hour video files using keyframe skipping.
- **Search Latency:** Sub-second (<350ms) vector similarity retrieval across 50,000+ indexed tracklets.
- **Verification Accuracy:** >98% precision on Top-5 candidate re-ranking with Gemini Flash.
- **Zero Cloud Leakage:** All raw video files remain strictly on the host file system.
