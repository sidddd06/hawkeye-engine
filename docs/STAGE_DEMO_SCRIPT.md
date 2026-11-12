# HawkEye / BountyCam - 3-Minute Live Stage Demo Script & Judge Q&A Cheat Sheet

**Target Presentation Time:** Exactly 3 Minutes (180 Seconds)  
**Presenters:** 2-Person Team  
- **Presenter 1 (Team Leader - RTX 4070 Track):** Vision Engine, 4-Stage Sieve, Ingestion, Multimodal Search & Gemini Verification.  
- **Presenter 2 (Teammate - RTX 3050 Track):** Spatial Math, Polygon Tripwire, Multi-Camera Escape Map, Video Synopsis & SHA-256 Dossier.  
**Screen Setup:** HawkEye Forensic Dashboard running full-screen at `http://localhost:3000`.

---

## 1. Word-for-Word 3-Minute Stage Script

### [00:00 - 00:30] The Hook & The Problem (Presenter 1)
* **Spoken:**  
  *"Judges, imagine a factory warehouse or campus gate is burgled at 2:00 AM. The security team hands the police 12 hours of raw CCTV footage. What happens today? A human officer sits in a dark room manually scrubbing through 12 hours of empty video for days. If they try sending it to the cloud, a 12-hour 4K dump is 40 gigabytes—impossible over local internet, completely violating privacy laws, and costing hundreds of dollars in cloud API tokens.*  
  *We built **HawkEye / BountyCam**: a Zero-Cloud, local-first CCTV forensic engine that processes 12 hours of surveillance video in minutes right on your laptop GPU, letting you search footage like Google with court-admissible evidence chains."*
* **Screen Action:**  
  Dashboard is open on the tactical dark UI (`http://localhost:3000`). Point cursor to the live GPU badge showing `NVIDIA GeForce RTX 4070 (8.0 GB VRAM) // ONLINE`.

---

### [00:30 - 01:15] The 4-Stage Sieve & Natural Language Search (Presenter 1)
* **Spoken:**  
  *"The secret to our speed is our **4-Stage Cascading Sieve**. We don't decode raw video frames. In Stage 1, we jump directly between compressed I-frames using PyAV and compute a low-resolution 160x90 difference matrix. This instantly discards up to 98% of empty footage with zero GPU load.*  
  *Crucially, we fixed the fatal flaw of keyframe skipping: **Motion Wake-Up Burst**. The millisecond motion exceeds 1%, we dynamically wake up and decode the next 3 seconds at 10 FPS so ByteTrack never loses a fast bike.*  
  *Let's search. I'll click our **Judge Demo Mode** and select Scenario 1: High-Speed Motorcycle Escape."*
* **Screen Action:**  
  Click `⚡ JUDGE DEMO MODE` &rarr; click `SCENARIO 1: HIGH-SPEED MOTORCYCLE ESCAPE`.  
  Type in the search bar: `red motorcycle speeding rider blue backpack` and hit <kbd>Enter</kbd>.
* **Spoken:**  
  *"In under 20 milliseconds, our SigLIP 768-dimensional FAISS index ranks the top suspect crops. Notice tracklet ID 42: a red Bajaj Pulsar moving at 42 km/h. When I click the timestamp, the synchronized HTML5 player jumps directly to the exact second, tracking the bike with 60 FPS neon bounding boxes.  
  Notice the verification badge: Stage 4 queries Gemini 2.5 Flash on just this single 50x50 crop to confirm attributes—costing fractions of a cent, with 100% offline fallback if internet drops."*
* **Screen Action:**  
  Click the top search result card. The player instantly seeks to `00:03.44`, and the canvas draws the neon cyan box around the motorcycle.

---

### [01:15 - 02:00] Spatial Intelligence: Tripwires & Multi-Cam Escape Map (Presenter 2)
* **Spoken:**  
  *"Now let's switch to spatial intelligence. Say the investigator wants to know if this motorcycle breached a restricted loading bay or campus perimeter.*  
  *I switch to the **Tripwire Engine**. With HTML5 canvas, I can draw an arbitrary polygon over any zone or click 'Main Gate Perimeter'. Behind the scenes, our Shapely vector math checks point-in-polygon containment against the suspect's trajectory. It immediately flags Track ID 42 with a dwell time of 2.1 seconds—a confirmed breach."*
* **Screen Action:**  
  Click the `TRIPWIRE & ESCAPE MAP` tab.  
  Click the preset button `GATE PERIMETER`. The polygon lights up red and the detection drawer shows Tracklet #42.
* **Spoken:**  
  *"Even better: criminals don't stay in front of one camera. Our **Multi-Camera Escape Map** links detections across cameras using Haversine distance and timestamp deltas.  
  Look at this vector: Suspect 42 was seen at Campus Gate at 03:14, then Hostel Road 45 seconds later, and merged onto the NH48 Highway at 58 km/h. We have their exact escape vector across Noida in under 30 seconds."*
* **Screen Action:**  
  Scroll to the Leaflet interactive map. Hover over Waypoint 1 (Gate), Waypoint 2 (Hostel Road), and Waypoint 3 (NH48 Highway).

---

### [02:00 - 02:35] Video Synopsis & Cryptographic Dossier (Presenter 2)
* **Spoken:**  
  *"What if an officer needs to review 12 hours of footage visually in 60 seconds? Standard synopsis tools look awful because they paste rectangular boxes.  
  We implemented **Foreground MOG2 Alpha Feathering with Neon HUD Tags**. As you can see in this 30x synopsis, objects from completely different hours are overlaid simultaneously onto a static median background, each floating with their timestamp and speed tags.*  
  *When it's time to take this suspect to court, click **Generate Forensic Dossier**."*
* **Screen Action:**  
  Click the `SYNOPSIS & DOSSIER` tab.  
  Play the synopsis feed.  
  Click `GENERATE FORENSIC EVIDENCE DOSSIER`.
* **Spoken:**  
  *"HawkEye generates a court-admissible JSON/PDF evidence package sealed with a composite SHA-256 hash across every frame crop, timestamp, and camera metadata. Any tampering with a single pixel invalidates the cryptographic seal.  
  Finally, for community policing, our P2P Bounty Mesh broadcasts the suspect's anonymous visual hash across neighborhood nodes—zero cloud, zero PII leak."*
* **Screen Action:**  
  Click `PRINT OFFICIAL EVIDENCE CERTIFICATE` (previewing the print sheet) and click `BROADCAST TO P2P BOUNTY MESH` to show the active peer nodes.

---

### [02:35 - 03:00] Technical Secret Sauce & Conclusion (Presenter 1 & 2 Together)
* **Spoken (Presenter 1):**  
  *"To build this, we operated as a 2-person team on different laptops: an RTX 4070 and an RTX 3050. Our architecture enforces strict hardware VRAM auto-scaling: batch size 64 on 8GB VRAM down to 16 on 4GB VRAM, with 100% offline air-gapped readiness.*  
* **Spoken (Presenter 2):**  
  *HawkEye turns 12 hours of useless CCTV into 30 seconds of actionable, court-admissible intelligence without uploading a single byte to the cloud.*  
* **Both:**  
  *Thank you. We are ready for your questions."*

---

## 2. Judge Q&A Cheat Sheet (Top 5 Tough Technical Questions)

### Q1: "If you skip keyframes to jump every 2 seconds, won't you miss a fast motorcycle traveling at 80 km/h between I-frames?"
* **Answer:**  
  *"That was our first critical flaw mitigation: **Fix 1 (Motion Wake-Up Burst)**. We only use keyframes to determine if the scene is static. The moment the low-res 160x90 matrix difference exceeds 1.0%, our PyAV demuxer immediately drops the keyframe-only mode and decodes the subsequent 3.0 seconds at 10 FPS. That gives ByteTrack 30 continuous frames to acquire, track, and compute the speed vector of the motorcycle before returning to keyframe skip mode. It gives us the speed of keyframe skipping with the tracking accuracy of full decoding."*

### Q2: "Why not just stream the 12 hours of video directly into Gemini 2.5 Flash video input?"
* **Answer:**  
  *"Three reasons: Bandwidth, Cost, and Privacy.  
  First, 12 hours of 1080p CCTV is over 20 to 40 GB. In real-world police stations, toll booths, and remote warehouses, upstream bandwidth is 5 to 10 Mbps—it would take 8 hours just to upload the file.  
  Second, 12 hours of continuous video tokens in Gemini Flash costs substantial API dollars per query.  
  Third, government and enterprise privacy policies strictly forbid streaming raw CCTV surveillance feeds to public cloud endpoints.  
  HawkEye does 99.9% of the heavy lifting locally on an RTX laptop GPU for free, sending only the top 5 cropped 100x100 pixel bounding boxes to Gemini Flash for OCR or attribute confirmation. It's 1000x cheaper, zero-cloud compliant, and works completely offline."*

### Q3: "How does your system handle monochrome infrared night-vision footage where color search fails?"
* **Answer:**  
  *"We built **Fix 4 (Auto-IR Saturation Detector)**. The engine calculates the mean HSV saturation $S$ across incoming frames. If $S < 15.0$, the system automatically detects night-vision mode, renders a `🌙 IR Night Mode Detected` forensic UI badge, and re-weights our SigLIP semantic query embeddings to prioritize geometry, vehicle class, and posture over color terms. A query for 'red motorcycle' in IR mode automatically matches vehicle class and rider silhouette rather than failing on black-and-white pixels."*

### Q4: "What happens if a tiny bird or distant background object triggers false detections?"
* **Answer:**  
  *"That is **Fix 2 (50x50px Minimum Filter + 15% Context Padding)**. We automatically prune any bounding box where $(x2 - x1) \times (y2 - y1) < 2500$ square pixels, discarding distant street noise, camera sensor artifacts, and insects. Furthermore, for every valid detection, we expand the bounding box by 15% on all four borders so helmets, backpacks, and vehicle chassis aren't clipped when passed to SigLIP embedding and Gemini Flash."*

### Q5: "How does the SHA-256 evidence chain prove court admissibility in a criminal trial?"
* **Answer:**  
  *"Section 65B of the Indian Evidence Act and US Federal Rules of Evidence require proof of digital chain of custody. When HawkEye indexes video, it computes the SHA-256 hash of each extracted raw crop directly from memory. When generating the dossier, it computes a composite Merkle root combining the camera ID, UNIX timestamp, bounding box coordinates, and individual crop hashes. If anyone edits or tampers with a single pixel in Photoshop, the composite hash changes completely, immediately flagging the dossier as corrupted."*
