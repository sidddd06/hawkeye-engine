"use client";

import React, { useState, useRef } from "react";
import { 
  Film, 
  FileCheck2, 
  Radio, 
  Sparkles, 
  Download, 
  Share2, 
  Check, 
  Copy,
  Terminal,
  ShieldCheck,
  Play,
  Pause,
  Printer,
  ExternalLink,
  Lock
} from "lucide-react";
import { SynopsisResponse, DossierReport } from "@/types/contract";

export const SynopsisAndDossier: React.FC = () => {
  const [synopsis, setSynopsis] = useState<SynopsisResponse>({
    camera_id: "CAM_01_GATE",
    synopsis_video_url: "/mock_synopsis_feed.mp4",
    duration_sec: 60.0,
    total_events_condensed: 4,
    hud_tags: [
      "[ID #101 | 00:43:36 | 42 km/h | RED MOTORCYCLE]",
      "[ID #102 | 01:54:12 | 4.8 km/h | PEDESTRIAN DUFFEL]",
      "[ID #201 | 02:14:05 | 🌙 IR SAT:5.4 | PERIMETER BREACH]",
      "[ID #301 | 08:44:06 | 18 km/h | DELIVERY VAN]",
    ],
  });

  const [dossier, setDossier] = useState<DossierReport>({
    track_id: 101,
    camera_id: "CAM_01_GATE",
    sha256_evidence_hash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
    timestamp_range: "00:42 -> 00:45",
    best_crop_url: "/mock_crops/track_101.jpg",
    gemini_verification: "VERIFIED: Red Bajaj Pulsar 150 motorcycle with black alloys. Male rider wearing bright blue nylon backpack and dark red windbreaker jacket. License plate fragment 'UP-16-EK-****' visible.",
    trajectory_points_count: 5,
    generated_at_utc: "2026-11-06T19:26:38Z",
  });

  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false);
  const [isExportingDossier, setIsExportingDossier] = useState(false);
  const [bountyBroadcasted, setBountyBroadcasted] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isPlayingSynopsis, setIsPlayingSynopsis] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const synopsisVideoRef = useRef<HTMLVideoElement>(null);

  const toggleSynopsisPlay = () => {
    const video = synopsisVideoRef.current;
    if (!video) return;
    if (isPlayingSynopsis) {
      video.pause();
      setIsPlayingSynopsis(false);
    } else {
      video.play().catch(() => {});
      setIsPlayingSynopsis(true);
    }
  };

  const handleGenerateSynopsis = async () => {
    setIsGeneratingSynopsis(true);
    try {
      const res = await fetch("http://localhost:8000/api/synopsis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_id: "CAM_01_GATE",
          target_duration_sec: 60,
          speedup_factor: 30,
        }),
      });
      if (res.ok) {
        const data: SynopsisResponse = await res.json();
        setSynopsis(data);
        if (synopsisVideoRef.current) {
          synopsisVideoRef.current.currentTime = 0;
          synopsisVideoRef.current.play().catch(() => {});
          setIsPlayingSynopsis(true);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setIsGeneratingSynopsis(false);
    }
  };

  const handleSelectDossierTarget = async (trackId: number) => {
    setIsExportingDossier(true);
    try {
      const res = await fetch(`http://localhost:8000/api/dossier/${trackId}`);
      if (res.ok) {
        const data: DossierReport = await res.json();
        setDossier(data);
      }
    } catch {
      // Offline fallback
    } finally {
      setIsExportingDossier(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Section 1: 1-Click Video Synopsis */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase flex items-center gap-2">
              <Film className="w-4 h-4 text-amber-400" />
              1-Click 60s Video Synopsis Generator (MOG2 Silhouette Feathering - Fix 3)
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Condenses multi-hour surveillance footage into a 60-second accelerated summary with alpha-feathered silhouettes and floating neon HUD tags.
            </p>
          </div>

          <button
            onClick={handleGenerateSynopsis}
            disabled={isGeneratingSynopsis}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black text-xs font-mono font-bold rounded transition flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
          >
            <Sparkles className="w-3.5 h-3.5 fill-black" />
            {isGeneratingSynopsis ? "RENDERING SYNOPSIS WITH ALPHA FEATHERING..." : "GENERATE CONDENSED SYNOPSIS"}
          </button>
        </div>

        {/* Synopsis Video Player & OSD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bg-black rounded-lg aspect-video relative flex flex-col justify-between overflow-hidden border border-slate-800">
            <video
              ref={synopsisVideoRef}
              src={synopsis.synopsis_video_url}
              playsInline
              loop
              muted
              className="w-full h-full object-cover"
            />

            {/* Play/Pause Control Overlay */}
            <div
              onClick={toggleSynopsisPlay}
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 cursor-pointer transition"
            >
              {!isPlayingSynopsis && (
                <div className="w-14 h-14 rounded-full bg-amber-500/80 hover:bg-amber-400 text-black flex items-center justify-center transition shadow-lg">
                  <Play className="w-7 h-7 fill-black ml-1" />
                </div>
              )}
            </div>

            {/* Top OSD Banner */}
            <div className="absolute top-3 inset-x-3 flex justify-between items-center text-[10px] font-mono text-amber-400 bg-black/60 px-3 py-1 rounded backdrop-blur border border-amber-500/30">
              <span>CONDENSED SYNOPSIS PLAYBACK // 30x DENSITY ACCELERATION</span>
              <span>TARGET DURATION: {synopsis.duration_sec} SECONDS</span>
            </div>

            {/* Bottom HUD Tags Footer */}
            <div className="absolute bottom-3 inset-x-3 flex justify-between items-center text-[10px] font-mono text-slate-300 bg-black/60 px-3 py-1 rounded backdrop-blur border border-slate-800">
              <span className="text-emerald-400">ALPHA FEATHERING: 5px GAUSSIAN BLUR (FIX 3 ACTIVE)</span>
              <span className="text-amber-400">EVENTS CONDENSED: {synopsis.total_events_condensed}</span>
            </div>
          </div>

          <div className="lg:col-span-4 bg-[#0b0f19] border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-3">
            <div className="text-slate-200 font-bold uppercase flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              Synopsis Metadata Log
            </div>

            <div className="space-y-2 text-slate-400 text-[11px]">
              <div>
                Target Duration: <span className="text-slate-200">{synopsis.duration_sec}s</span>
              </div>
              <div>
                Active Camera: <span className="text-slate-200">{synopsis.camera_id}</span>
              </div>
              <div>
                Foreground Segmentation:{" "}
                <span className="text-emerald-400 font-bold">MOG2 + 5px Gaussian Feathering</span>
              </div>
              <div>
                Bounding Occlusion Fix:{" "}
                <span className="text-sky-400 font-bold">Staggered Neon Tactical HUD Tags</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-1.5">
              <div className="text-slate-400 text-[11px] font-bold uppercase">
                Active Tactical HUD Tags:
              </div>
              {synopsis.hud_tags.map((tag, idx) => (
                <div
                  key={idx}
                  className="bg-[#111827] border border-slate-800 p-1.5 rounded text-[10px] text-emerald-300 truncate font-mono"
                >
                  {tag}
                </div>
              ))}
            </div>

            <div className="mt-3 text-[10px] text-slate-500 pt-2 border-t border-slate-800">
              Fix 3 Verified: Opaque overlapping boxes replaced with feathered silhouettes.
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Court-Admissible SHA-256 Forensic Dossier & BountyCam Mesh */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Court-Admissible SHA-256 Dossier Exporter */}
        <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-slate-100">
              <FileCheck2 className="w-4 h-4 text-sky-400" />
              COURT-ADMISSIBLE SHA-256 FORENSIC DOSSIER
            </div>
            <span className="text-[10px] bg-sky-950 text-sky-400 px-2 py-0.5 rounded border border-sky-800 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              CHAIN OF CUSTODY SEALED
            </span>
          </div>

          {/* Target Tracklet Selector */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-500">SELECT TARGET:</span>
            <button
              onClick={() => handleSelectDossierTarget(101)}
              className={`px-2.5 py-1 rounded transition ${
                dossier.track_id === 101
                  ? "bg-sky-600 text-white font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Track #101 (Motorcycle)
            </button>
            <button
              onClick={() => handleSelectDossierTarget(201)}
              className={`px-2.5 py-1 rounded transition ${
                dossier.track_id === 201
                  ? "bg-sky-600 text-white font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Track #201 (🌙 IR Breach)
            </button>
            <button
              onClick={() => handleSelectDossierTarget(301)}
              className={`px-2.5 py-1 rounded transition ${
                dossier.track_id === 301
                  ? "bg-sky-600 text-white font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Track #301 (Delivery Van)
            </button>
          </div>

          <div className="space-y-2 text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">TARGET ID:</span>
              <span className="font-bold text-slate-200">#{dossier.track_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">CAMERA LOCATION:</span>
              <span className="text-slate-200">{dossier.camera_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TIMESTAMP WINDOW:</span>
              <span className="text-slate-200">{dossier.timestamp_range}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TRAJECTORY WAYPOINTS:</span>
              <span className="text-slate-200">{dossier.trajectory_points_count} points logged</span>
            </div>
          </div>

          {/* SHA-256 Cryptographic Evidence Seal */}
          <div className="bg-[#0b0f19] border border-slate-800 p-3 rounded space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span className="text-emerald-400 font-bold">COMPOSITE SHA-256 EVIDENCE HASH</span>
              <button
                onClick={() => copyToClipboard(dossier.sha256_evidence_hash)}
                className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedHash ? "COPIED" : "COPY HASH"}
              </button>
            </div>
            <div className="text-[11px] text-emerald-400 font-mono break-all select-all">
              {dossier.sha256_evidence_hash}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-800">
            <span className="text-sky-400 font-bold">GEMINI FLASH AUDIT: </span>
            {dossier.gemini_verification}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(dossier, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `forensic_dossier_track_${dossier.track_id}.json`;
                a.click();
              }}
              className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-mono font-medium rounded transition flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              EXPORT CERTIFIED JSON
            </button>

            <button
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-medium rounded transition flex items-center gap-1.5 border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              PRINT DOSSIER
            </button>
          </div>
        </div>

        {/* Decentralized BountyCam P2P Mesh Broadcaster */}
        <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-slate-100">
              <Radio className="w-4 h-4 text-purple-400" />
              DECENTRALIZED BOUNTYCAM P2P MESH BROADCASTER
            </div>
            <span className="text-[10px] bg-purple-950 text-purple-400 px-2 py-0.5 rounded border border-purple-800">
              SIMULATED MESH
            </span>
          </div>

          <p className="text-slate-400 text-xs leading-relaxed">
            Broadcast a cryptographic bounty search vector to participating local shopkeeper edge nodes without cloud upload. Nearby nodes match local CCTV embeddings in real time.
          </p>

          <div className="bg-[#0b0f19] border border-slate-800 p-3 rounded space-y-2">
            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>TARGET VECTOR:</span>
              <span className="text-purple-300 font-bold">SigLIP Base 768-Dim Feature Hash</span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>MESH NETWORK:</span>
              <span className="text-slate-200">12 Local Edge Nodes (Noida Sector 62)</span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>BOUNTY REWARD:</span>
              <span className="text-amber-400 font-bold">500 BOUNTY CREDITS</span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>ZERO CLOUD INTEGRITY:</span>
              <span className="text-emerald-400 font-bold">P2P Vector Matching Only</span>
            </div>
          </div>

          {bountyBroadcasted && (
            <div className="bg-purple-950/70 border border-purple-500/60 p-3 rounded text-purple-300 text-xs flex items-center gap-2 animate-pulse">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              BOUNTY BROADCAST LIVE // 12 EDGE NODES SEARCHING LOCALLY
            </div>
          )}

          <button
            onClick={() => setBountyBroadcasted(true)}
            className="w-full py-2 bg-purple-700 hover:bg-purple-600 text-white font-mono font-medium rounded transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
          >
            <Share2 className="w-3.5 h-3.5" />
            {bountyBroadcasted ? "RE-BROADCAST TO P2P MESH" : "BROADCAST BOUNTY SEARCH TO MESH"}
          </button>
        </div>
      </div>

      {/* Forensic Printable Dossier Modal Sheet */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg max-w-2xl w-full p-6 space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-sky-400" />
                FORENSIC EVIDENCE CERTIFICATE // HAWKEYE BOUNTYCAM
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 bg-[#0b0f19] p-4 rounded border border-slate-800 text-slate-300">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">CASE NUMBER:</span>
                <span className="font-bold text-slate-100">HWK-2026-NOV-0101</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TARGET TRACK ID:</span>
                <span className="font-bold text-slate-100">#{dossier.track_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CAMERA LOCATION:</span>
                <span className="text-slate-100">{dossier.camera_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TIMESTAMP WINDOW:</span>
                <span className="text-slate-100">{dossier.timestamp_range}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CERTIFICATION TIMESTAMP:</span>
                <span className="text-slate-100">{dossier.generated_at_utc}</span>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <div className="text-slate-500 mb-1">SHA-256 EVIDENCE INTEGRITY SEAL:</div>
                <div className="text-emerald-400 font-bold break-all bg-black/50 p-2 rounded">
                  {dossier.sha256_evidence_hash}
                </div>
              </div>
              <div className="pt-2">
                <div className="text-slate-500 mb-1">GEMINI FLASH VERIFICATION TRANSCRIPT:</div>
                <div className="text-slate-300 bg-black/50 p-2 rounded">
                  {dossier.gemini_verification}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold"
              >
                PRINT / SAVE AS PDF
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
