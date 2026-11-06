# HawkEye / BountyCam - Master Progress Checklist

---

### [X] Part 1: Project Brief, Workspace Inspection & Baseline Records
- [x] Audit workspace directory structure for existing files, packages, or virtual environments.
- [x] Detect host environment tooling (Node.js, npm, Python, Git, NVIDIA GPU).
- [x] Author formal Project Brief (`docs/PROJECT_BRIEF.md`) defining RWA, Warehouse, and Police user personas.
- [x] Formulate Flaw-to-Mitigation Matrix (`docs/FLAW_MITIGATION_MATRIX.md`) with the 4 mandatory mitigations + pipeline optimizations.
- [x] Initialize Architectural Decisions Log (`docs/DECISIONS_LOG.md`) D-01 through D-05.
- [x] Initialize Open Issues & Risk Register (`docs/OPEN_ISSUES.md`).
- [x] Initialize Master Progress Checklist (`docs/PROGRESS_CHECKLIST.md`).
- [x] Deliver Part 1 Summary Report.

---

### [X] Part 2: Scope Definition, MoSCoW Prioritization & User Stories
- [x] Define P0 (Must Have): Core Ingestion, Cascading Sieve, Multimodal Search, Timestamp Jump.
- [x] Define P1 (Should Have): Spatial Polygon Tripwire, Multi-Cam Escape Map, Video Synopsis, IR Night Badge.
- [x] Define P2 (Could Have / Simulated): P2P Bounty Mesh Broadcast (simulated), SHA-256 Dossier Exporter.
- [x] Author rigorous `CONTRACTS.md` AI Brain Lock preventing context drift between RTX 4070 and RTX 3050 tracks.
- [x] Establish simulated vs. native boundaries for hackathon integrity.

---

### [X] Part 3: UX Flows, Information Architecture & Screen Specifications
- [x] Map out 4-tab dashboard information architecture (Ingestion, Search/Player, Tripwire/Map, Synopsis/Dossier).
- [x] Design Palantir-style dark forensic UI layout, HUD telemetry badges, and GPU status indicators.
- [x] Detail responsive layout rules for 1080p and laptop screens.
- [x] Define visual states: loading skeletons, empty search results, and error boundaries.
- [x] Specify tactical keyboard shortcuts (Space for play/pause, Ctrl+F for search focus).

---

### [X] Part 4: Technical Architecture, Data Models & API Contracts
- [x] Author locked shared data schemas in `backend/schemas.py` (Pydantic v2).
- [x] Author locked shared data interfaces in `frontend/src/types/contract.ts` (TypeScript).
- [x] Ensure 100% snake_case JSON field alignment between frontend and backend.
- [x] Author realistic seed data in `shared_mock_data/sample_tracklets.json` (8 tracklets across 3 cameras with Noida/Delhi coordinates and night-vision IR records).
- [x] Define Stage 4 Gemini Flash verification protocol and offline fallback mode.

---

### [X] Part 5: Prototype Foundation, Dependencies & Design System Shell
- [x] Scaffold Next.js frontend with Tailwind CSS and dark forensic design tokens.
- [x] Build modular component architecture separating Member 1 (`member1_core/`) and Member 2 (`member2_spatial/`).
- [x] Scaffold FastAPI backend service with CORS middleware, health endpoints, and modular routes.
- [x] Construct global application shell (`frontend/src/app/page.tsx`) with tactical header, GPU status, and 1-click Judge Demo button.
- [x] Create 1-click launcher script `start_demo.bat`.
- [x] Verify backend python imports and endpoints with 100% pass rate.
- [x] Verify frontend TypeScript compilation and Next.js production build (`next build`) with 0 errors.

---

### [ ] Part 6: Primary User Journey (P0) Implementation
- [ ] Implement backend 4-stage cascading sieve in `backend/`:
  - Stage 1: PyAV keyframe skip + low-res matrix diff + motion wake-up burst.
  - Stage 2: Batched YOLOv8n + ByteTrack + 50x50 filter + 15% context padding + sharpest crop selection.
  - Stage 3: SigLIP base embedding + FAISS index store.
  - Stage 4: Gemini Flash precision verifier integration.
- [ ] Implement FastAPI endpoints (`/index`, `/search`, `/telemetry`).
- [ ] Build Next.js frontend ingestion drag-and-drop zone and live telemetry counters.
- [ ] Build multimodal text/image search bar and synchronized HTML5 video player with bounding box overlays.
- [ ] Verify P0 end-to-end loop with sample video media.
- [ ] Present Part 6 Report and await user approval before proceeding to Part 7.

---

### [ ] Part 7: Differentiator Features (P1) & Edge-Case States
- [ ] Implement interactive HTML5 Canvas drawing tools for Polygon Tripwire.
- [ ] Implement backend Shapely point-in-polygon trajectory intersection checks.
- [ ] Integrate Leaflet Multi-Camera Escape Map with chronological trajectory and speed estimation.
- [ ] Build 1-Click Video Synopsis renderer with silhouette alpha feathering and neon HUD tags.
- [ ] Implement Auto-IR saturation detector and glowing UI badge.
- [ ] Implement cryptographic SHA-256 Forensic Dossier exporter.
- [ ] Present Part 7 Report and await user approval before proceeding to Part 8.

---

### [ ] Part 8: Testing, Usability Audit & Edge-Case Defect Remediation
- [ ] Run end-to-end integration tests across multi-hour video feeds and varied resolutions.
- [ ] Audit video scrubbing and timestamp jumping for state desynchronization.
- [ ] Stress-test edge cases: empty search results, corrupted video chunks, GPU VRAM pressure.
- [ ] Fix identified defects directly in code and verify zero lingering regressions.
- [ ] Present Part 8 Report and await user approval before proceeding to Part 9.

---

### [ ] Part 9: Accessibility, Visual Polish, Performance & Demo Readiness Mode
- [ ] Implement ARIA labels, keyboard focus rings, and tactical shortcut listeners.
- [ ] Optimize React rendering and Canvas redraw loops to maintain 60 FPS.
- [ ] Build 1-click "Judge Demo Scenario Loader" button to instantly populate pre-indexed CCTV sample data.
- [ ] Polish forensic aesthetic with high-contrast tactical badges and telemetry typography.
- [ ] Present Part 9 Report and await user approval before proceeding to Part 10.

---

### [ ] Part 10: Final Verification, Run Guide, Offline Fallback & Stage Script
- [ ] Compile complete Requirements Traceability Matrix.
- [ ] Author local execution guide (`uvicorn` backend + `npm run dev` frontend) and offline fallback instructions.
- [ ] Draft word-for-word 3-Minute Live Stage Demo Script and Judge Q&A cheat sheet.
- [ ] Package final copy-pasteable handoff documentation.
- [ ] Present final completion package.
