"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { TrackletRecord } from "@/types/contract";

// ============================================================================
// Types matching POST /api/spatial/synopsis-dossier request/response
// ============================================================================

interface SynopsisCluster {
  cluster_id: string;
  track_id: string;
  camera_id: string;
  original_start_time_sec: number;
  original_end_time_sec: number;
  synopsis_start_sec: number;
  synopsis_end_sec: number;
  speedup_ratio: number;
  neon_hud_tag: string;
  crop_url: string | null;
  object_class: string;
}

interface CameraSightingRecord {
  camera_id: string;
  first_seen_sec: number;
  last_seen_sec: number;
  duration_sec: number;
  estimated_speed_kmh: number;
  crop_url: string | null;
}

interface TripwireBreachLog {
  breach_id: string;
  camera_id: string;
  timestamp_sec: number;
  zone_name: string;
  dwell_time_sec: number;
  severity: string;
  threat_increment: number;
}

interface SuspectReIDProfile {
  track_id: string;
  object_class: string;
  best_crop_url: string | null;
  is_ir_night_mode: boolean;
  confirmed_attributes: Record<string, unknown>;
  total_sightings: number;
  cameras_traversed: string[];
}

interface ForensicDossier {
  case_id: string;
  generated_at_utc: string;
  suspect_profile: SuspectReIDProfile;
  chronological_sightings: CameraSightingRecord[];
  breach_logs: TripwireBreachLog[];
  threat_score: number;
  threat_level: "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";
  admissibility_standard: string;
  evidence_seal_sha256: string;
}

interface SynopsisDossierResponse {
  case_id: string;
  raw_duration_sec: number;
  synopsis_duration_sec: number;
  temporal_compression_factor: number;
  active_clusters_count: number;
  synopsis_index: SynopsisCluster[];
  forensic_dossier: ForensicDossier;
}

// ============================================================================
// Fallback simulation data
// ============================================================================

const FALLBACK_RESPONSE: SynopsisDossierResponse = {
  case_id: "CASE-NOIDA-CCTV-042",
  raw_duration_sec: 43200,
  synopsis_duration_sec: 60.0,
  temporal_compression_factor: 720.0,
  active_clusters_count: 5,
  synopsis_index: [
    { cluster_id: "SYN_001", track_id: "42", camera_id: "CAM_01_GATE", original_start_time_sec: 3600, original_end_time_sec: 3614, synopsis_start_sec: 0.0, synopsis_end_sec: 8.5, speedup_ratio: 1.6, neon_hud_tag: "[ID #42 | 01:00:00 | 42.0 km/h]", crop_url: "/mock_crops/track_42.jpg", object_class: "motorcycle" },
    { cluster_id: "SYN_002", track_id: "42", camera_id: "CAM_02_HOSTEL_RD", original_start_time_sec: 3650, original_end_time_sec: 3668, synopsis_start_sec: 10.0, synopsis_end_sec: 20.5, speedup_ratio: 1.7, neon_hud_tag: "[ID #42 | 01:00:50 | 58.0 km/h]", crop_url: "/mock_crops/track_42_hostel.jpg", object_class: "motorcycle" },
    { cluster_id: "SYN_003", track_id: "88", camera_id: "CAM_01_GATE", original_start_time_sec: 14400, original_end_time_sec: 14420, synopsis_start_sec: 22.0, synopsis_end_sec: 32.0, speedup_ratio: 2.0, neon_hud_tag: "[ID #88 | 04:00:00 | 4.2 km/h]", crop_url: "/mock_crops/track_88.jpg", object_class: "person" },
    { cluster_id: "SYN_004", track_id: "101", camera_id: "CAM_05_NORTH_PERIMETER", original_start_time_sec: 8100, original_end_time_sec: 8112, synopsis_start_sec: 35.0, synopsis_end_sec: 42.0, speedup_ratio: 1.7, neon_hud_tag: "[ID #101 | 02:15:00 | 2.8 km/h]", crop_url: null, object_class: "person" },
    { cluster_id: "SYN_005", track_id: "42", camera_id: "CAM_03_NH48", original_start_time_sec: 3700, original_end_time_sec: 3720, synopsis_start_sec: 45.0, synopsis_end_sec: 57.0, speedup_ratio: 1.7, neon_hud_tag: "[ID #42 | 01:01:40 | 72.0 km/h]", crop_url: "/mock_crops/track_42_nh48.jpg", object_class: "motorcycle" },
  ],
  forensic_dossier: {
    case_id: "CASE-NOIDA-CCTV-042",
    generated_at_utc: "2026-11-12T04:00:00Z",
    suspect_profile: {
      track_id: "42",
      object_class: "motorcycle",
      best_crop_url: "/mock_crops/track_42.jpg",
      is_ir_night_mode: false,
      confirmed_attributes: { helmet_detected: true, backpack_detected: true, vehicle_color: "crimson_red", cross_camera_confidence: 0.942 },
      total_sightings: 24,
      cameras_traversed: ["CAM_01_GATE", "CAM_02_HOSTEL_RD", "CAM_03_NH48"],
    },
    chronological_sightings: [
      { camera_id: "CAM_01_GATE", first_seen_sec: 3600, last_seen_sec: 3614, duration_sec: 14.0, estimated_speed_kmh: 42.0, crop_url: "/mock_crops/track_42.jpg" },
      { camera_id: "CAM_02_HOSTEL_RD", first_seen_sec: 3650, last_seen_sec: 3668, duration_sec: 18.0, estimated_speed_kmh: 58.0, crop_url: "/mock_crops/track_42_hostel.jpg" },
      { camera_id: "CAM_03_NH48", first_seen_sec: 3700, last_seen_sec: 3720, duration_sec: 20.0, estimated_speed_kmh: 72.0, crop_url: "/mock_crops/track_42_nh48.jpg" },
    ],
    breach_logs: [
      { breach_id: "BREACH-001-GATE", camera_id: "CAM_01_GATE", timestamp_sec: 3600, zone_name: "RESTRICTED_ACCESS_PORTAL", dwell_time_sec: 2.1, severity: "HIGH", threat_increment: 25.0 },
    ],
    threat_score: 80.0,
    threat_level: "HIGH",
    admissibility_standard: "Indian Evidence Act Section 65B / US FRE Rule 902 Digital Chain of Custody",
    evidence_seal_sha256: "a3b8f4c91e2d7a0b56c3e8f12d4a7b9c0e3f5a6b8d1c4e7f0a2b5d8e1c3f6a9",
  },
};

// ============================================================================
// Helpers
// ============================================================================

const THREAT_STYLES: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  LOW:      { bg: "bg-emerald-950", text: "text-emerald-400", border: "border-emerald-700", ring: "ring-emerald-500/30" },
  ELEVATED: { bg: "bg-amber-950",   text: "text-amber-400",   border: "border-amber-600",   ring: "ring-amber-500/30" },
  HIGH:     { bg: "bg-red-950",     text: "text-red-400",     border: "border-red-500",     ring: "ring-red-500/40" },
  CRITICAL: { bg: "bg-red-950",     text: "text-red-300",     border: "border-red-400",     ring: "ring-red-400/50" },
};

const OBJ_ICONS: Record<string, string> = {
  motorcycle: "🏍️",
  person: "🚶",
  car: "🚗",
  bicycle: "🚲",
  backpack: "🎒",
};

function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

// ============================================================================
// Component
// ============================================================================

type ViewTab = "synopsis" | "dossier";

export interface ForensicSynopsisDossierProps {
  tracklets?: TrackletRecord[] | null;
  videoUrl?: string;
}

export const ForensicSynopsisDossier: React.FC<ForensicSynopsisDossierProps> = ({
  tracklets = null,
  videoUrl = "/sample_cctv_feed.mp4",
}) => {
  const [response, setResponse] = useState<SynopsisDossierResponse>(FALLBACK_RESPONSE);
  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState<ViewTab>("synopsis");
  const [synopsisPlayhead, setSynopsisPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);
  const [isPrintView, setIsPrintView] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasRealTracklets = Boolean(tracklets && tracklets.length > 0);

  // -- API call --
  const fetchDossier = useCallback(async () => {
    setIsLoading(true);
    let detectionsPayload = [
      { detection_id: "det_1", track_id: "42", camera_id: "CAM_01_GATE", timestamp_sec: 3600.0, bbox: [200, 300, 280, 420], object_class: "motorcycle", confidence: 0.96 },
      { detection_id: "det_2", track_id: "42", camera_id: "CAM_01_GATE", timestamp_sec: 3608.0, bbox: [400, 450, 480, 560], object_class: "motorcycle", confidence: 0.95 },
      { detection_id: "det_3", track_id: "42", camera_id: "CAM_02_HOSTEL_RD", timestamp_sec: 3650.0, bbox: [500, 600, 580, 700], object_class: "motorcycle", confidence: 0.92, is_ir_night: true },
      { detection_id: "det_4", track_id: "42", camera_id: "CAM_03_NH48", timestamp_sec: 3700.0, bbox: [300, 400, 400, 520], object_class: "motorcycle", confidence: 0.90 },
      { detection_id: "det_5", track_id: "88", camera_id: "CAM_01_GATE", timestamp_sec: 14400.0, bbox: [100, 200, 160, 350], object_class: "person", confidence: 0.88 },
      { detection_id: "det_6", track_id: "101", camera_id: "CAM_05_NORTH_PERIMETER", timestamp_sec: 8100.0, bbox: [600, 100, 680, 300], object_class: "person", confidence: 0.85, is_ir_night: true },
    ];

    if (hasRealTracklets && tracklets) {
      detectionsPayload = tracklets.flatMap((t) =>
        t.trajectory.map((pt, idx) => ({
          detection_id: `det_${t.track_id}_${idx}`,
          track_id: String(t.track_id),
          camera_id: t.camera_id,
          timestamp_sec: pt.timestamp_sec,
          bbox: [pt.x1, pt.y1, pt.x2, pt.y2],
          object_class: t.object_class,
          confidence: t.similarity_score || 0.95,
          is_ir_night: t.is_ir_night_mode,
        }))
      );
    }

    const body = {
      case_id: hasRealTracklets ? "CASE-LIVE-SURVEILLANCE" : "CASE-NOIDA-CCTV-042",
      target_synopsis_duration_sec: 60.0,
      detections: detectionsPayload,
    };
    try {
      const res = await fetch("http://localhost:8000/api/spatial/synopsis-dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data: SynopsisDossierResponse = await res.json();
        setResponse(data);
      }
    } catch {
      setResponse(FALLBACK_RESPONSE);
    }
    setIsLoading(false);
  }, [hasRealTracklets, tracklets]);

  useEffect(() => { fetchDossier(); }, [fetchDossier]);

  // -- Synopsis playhead animation --
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setSynopsisPlayhead((prev) => {
          const next = prev + 0.3;
          return next >= response.synopsis_duration_sec ? 0 : next;
        });
      }, 50);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, response.synopsis_duration_sec]);

  // Active cluster at current playhead
  const activeCluster = response.synopsis_index.find(
    (c) => synopsisPlayhead >= c.synopsis_start_sec && synopsisPlayhead <= c.synopsis_end_sec
  );

  // Event density heatbar computation
  const heatbarSegments = (() => {
    const totalDuration = response.synopsis_duration_sec || 60;
    const numBins = 60;
    const binWidth = totalDuration / numBins;
    const bins: number[] = new Array(numBins).fill(0);
    response.synopsis_index.forEach((c) => {
      for (let t = c.synopsis_start_sec; t <= c.synopsis_end_sec; t += binWidth * 0.5) {
        const bin = Math.min(numBins - 1, Math.floor(t / binWidth));
        bins[bin] += 1;
      }
    });
    const maxDensity = Math.max(1, ...bins);
    return bins.map((v) => v / maxDensity);
  })();

  // -- Download JSON dossier --
  const downloadDossier = () => {
    const blob = new Blob([JSON.stringify(response.forensic_dossier, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${response.forensic_dossier.case_id}_dossier.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // -- Print dossier --
  const printDossier = () => {
    setIsPrintView(true);
    setTimeout(() => {
      window.print();
      setIsPrintView(false);
    }, 300);
  };

  const dossier = response.forensic_dossier;
  const threatStyle = THREAT_STYLES[dossier.threat_level] || THREAT_STYLES.LOW;

  return (
    <div className={`w-full bg-[#070a12] text-slate-100 rounded-lg border border-slate-800/80 ${isPrintView ? "print:bg-white print:text-black" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-[#0b0f19]/70 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-widest font-mono text-amber-400 uppercase">
            FORENSIC SYNOPSIS & EVIDENCE DOSSIER
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView("synopsis")}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded border transition ${
              activeView === "synopsis"
                ? "bg-sky-500/20 border-sky-400 text-sky-300"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            📊 SYNOPSIS
          </button>
          <button
            onClick={() => setActiveView("dossier")}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded border transition ${
              activeView === "dossier"
                ? "bg-red-500/20 border-red-400 text-red-300"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            📋 DOSSIER
          </button>
          <button
            onClick={fetchDossier}
            disabled={isLoading}
            className="px-2.5 py-1 text-[10px] font-mono font-bold rounded border bg-slate-900 border-slate-700 text-slate-400 hover:border-amber-500 hover:text-amber-400 transition disabled:opacity-40"
          >
            {isLoading ? "↻ LOADING…" : "↻ REFRESH"}
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SYNOPSIS VIEW                                                    */}
      {/* ================================================================ */}
      {activeView === "synopsis" && (
        <div className="p-4 space-y-4">
          {/* Compression Stats Bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="bg-[#111827] rounded px-3 py-1.5 border border-slate-800">
              <span className="text-[9px] font-mono text-slate-500">RAW DURATION</span>
              <div className="text-sm font-mono font-bold text-slate-300">{formatDuration(response.raw_duration_sec)}</div>
            </div>
            <div className="text-lg text-slate-600 font-mono">→</div>
            <div className="bg-[#111827] rounded px-3 py-1.5 border border-sky-800">
              <span className="text-[9px] font-mono text-sky-500">SYNOPSIS</span>
              <div className="text-sm font-mono font-bold text-sky-400">{formatDuration(response.synopsis_duration_sec)}</div>
            </div>
            <div className="bg-sky-500/10 border border-sky-500/30 rounded px-2.5 py-1.5">
              <span className="text-[9px] font-mono text-sky-400 font-bold">{response.temporal_compression_factor.toFixed(0)}× COMPRESSION</span>
            </div>
            <div className="bg-[#111827] rounded px-3 py-1.5 border border-slate-800">
              <span className="text-[9px] font-mono text-slate-500">ACTIVE EVENTS</span>
              <div className="text-sm font-mono font-bold text-emerald-400">{response.active_clusters_count}</div>
            </div>
          </div>

          {/* Event Density Heatbar */}
          <div>
            <div className="text-[10px] font-mono text-slate-500 mb-1.5 tracking-wider">EVENT DENSITY HEATBAR</div>
            <div className="flex h-6 rounded overflow-hidden border border-slate-800 bg-[#0a0e18]">
              {heatbarSegments.map((density, i) => {
                const synTime = (i / heatbarSegments.length) * response.synopsis_duration_sec;
                const isActive = activeCluster &&
                  synTime >= activeCluster.synopsis_start_sec &&
                  synTime <= activeCluster.synopsis_end_sec;
                return (
                  <div
                    key={i}
                    className="flex-1 transition-all duration-150 cursor-pointer"
                    style={{
                      backgroundColor:
                        density > 0.7 ? `rgba(239, 68, 68, ${0.3 + density * 0.5})` :
                        density > 0.3 ? `rgba(245, 158, 11, ${0.2 + density * 0.4})` :
                        density > 0 ? `rgba(56, 189, 248, ${0.1 + density * 0.3})` :
                        "transparent",
                      borderRight: isActive ? "1px solid #38bdf8" : "none",
                    }}
                    onClick={() => setSynopsisPlayhead(synTime)}
                    title={`${synTime.toFixed(1)}s — density ${(density * 100).toFixed(0)}%`}
                  />
                );
              })}
            </div>
            {/* Playhead marker */}
            <div className="relative h-1 mt-0.5">
              <div
                className="absolute top-0 w-0.5 h-3 bg-sky-400 rounded-full -mt-1"
                style={{ left: `${(synopsisPlayhead / response.synopsis_duration_sec) * 100}%` }}
              />
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded border transition ${
                isPlaying
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:border-sky-500"
              }`}
            >
              {isPlaying ? "⏸ PAUSE" : "▶ PLAY SYNOPSIS"}
            </button>
            <button
              onClick={() => { setSynopsisPlayhead(0); setIsPlaying(false); }}
              className="px-3 py-1.5 text-[10px] font-mono font-bold rounded border bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 transition"
            >
              ⏮ RESET
            </button>
            <span className="text-[10px] font-mono text-sky-400 tabular-nums font-bold">
              {synopsisPlayhead.toFixed(1)}s / {response.synopsis_duration_sec.toFixed(1)}s
            </span>
            {activeCluster && (
              <span className="text-[10px] font-mono text-amber-400 font-bold animate-pulse">
                ● {activeCluster.neon_hud_tag}
              </span>
            )}
          </div>

          {/* Synopsis Activity Tubes (Timeline Visualization) */}
          <div>
            <div className="text-[10px] font-mono text-slate-500 mb-2 tracking-wider">CONDENSED ACTIVITY TUBES</div>
            <div className="space-y-1.5">
              {response.synopsis_index.map((cluster) => {
                const leftPct = (cluster.synopsis_start_sec / response.synopsis_duration_sec) * 100;
                const widthPct = ((cluster.synopsis_end_sec - cluster.synopsis_start_sec) / response.synopsis_duration_sec) * 100;
                const isActive = synopsisPlayhead >= cluster.synopsis_start_sec && synopsisPlayhead <= cluster.synopsis_end_sec;
                const isHovered = hoveredCluster === cluster.cluster_id;

                const trackColors: Record<string, string> = {
                  "42": "bg-sky-500",
                  "88": "bg-purple-500",
                  "101": "bg-emerald-500",
                };
                const barColor = trackColors[cluster.track_id] || "bg-slate-500";

                return (
                  <div
                    key={cluster.cluster_id}
                    className="relative group"
                    onMouseEnter={() => setHoveredCluster(cluster.cluster_id)}
                    onMouseLeave={() => setHoveredCluster(null)}
                  >
                    <div className="flex items-center gap-2 h-8">
                      {/* Track label */}
                      <div className="w-24 flex items-center gap-1 text-[9px] font-mono text-slate-400 flex-shrink-0">
                        <span>{OBJ_ICONS[cluster.object_class] || "•"}</span>
                        <span className="truncate">#{cluster.track_id}</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-500 truncate">{cluster.camera_id.split("_").slice(-1)}</span>
                      </div>
                      {/* Activity tube */}
                      <div className="flex-1 h-full bg-[#0a0e18] rounded border border-slate-800/50 relative overflow-hidden cursor-pointer"
                        onClick={() => setSynopsisPlayhead(cluster.synopsis_start_sec)}
                      >
                        <div
                          className={`absolute top-0.5 bottom-0.5 rounded transition-all duration-200 ${barColor} ${
                            isActive ? "opacity-90 shadow-lg" : isHovered ? "opacity-60" : "opacity-35"
                          }`}
                          style={{ left: `${leftPct}%`, width: `${Math.max(1, widthPct)}%` }}
                        />
                        {/* Neon HUD tag inside tube */}
                        {(isActive || isHovered) && (
                          <div
                            className="absolute top-0 text-[8px] font-mono font-bold text-white bg-black/70 px-1 py-0.5 rounded whitespace-nowrap z-10"
                            style={{ left: `${leftPct + 1}%` }}
                          >
                            {cluster.neon_hud_tag}
                          </div>
                        )}
                      </div>
                      {/* Speedup badge */}
                      <div className="text-[8px] font-mono text-slate-500 w-10 text-right flex-shrink-0">
                        {cluster.speedup_ratio.toFixed(1)}×
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Timeline ticks */}
            <div className="flex justify-between ml-[104px] mr-[44px] mt-1 text-[8px] font-mono text-slate-600">
              {[0, 15, 30, 45, 60].map((t) => (
                <span key={t} className="cursor-pointer hover:text-sky-400" onClick={() => setSynopsisPlayhead(t)}>{t}s</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* FORENSIC DOSSIER VIEW                                            */}
      {/* ================================================================ */}
      {activeView === "dossier" && (
        <div className="p-4 space-y-4">
          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={downloadDossier}
              className="px-3 py-1.5 text-[10px] font-mono font-bold rounded border bg-sky-500/15 border-sky-500/40 text-sky-400 hover:bg-sky-500/25 transition"
            >
              📥 DOWNLOAD JSON DOSSIER
            </button>
            <button
              onClick={printDossier}
              className="px-3 py-1.5 text-[10px] font-mono font-bold rounded border bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25 transition"
            >
              🖨 PRINT OFFICIAL CERTIFICATE
            </button>
          </div>

          {/* Threat Level Banner */}
          <div className={`rounded-lg border p-4 ${threatStyle.bg} ${threatStyle.border} ${threatStyle.ring} ring-1`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-slate-500 mb-1">COMPOSITE THREAT ASSESSMENT</div>
                <div className={`text-2xl font-mono font-bold tabular-nums ${threatStyle.text}`}>
                  {dossier.threat_score.toFixed(1)} / 100
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded text-sm font-mono font-bold ${threatStyle.text} ${threatStyle.bg} border ${threatStyle.border}`}>
                ⚠ {dossier.threat_level}
              </div>
            </div>
            {/* Threat score bar */}
            <div className="mt-3 w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  dossier.threat_score >= 80 ? "bg-red-500" :
                  dossier.threat_score >= 60 ? "bg-amber-500" :
                  dossier.threat_score >= 40 ? "bg-amber-400" : "bg-emerald-500"
                }`}
                style={{ width: `${dossier.threat_score}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[8px] font-mono text-slate-600">
              <span>0 LOW</span><span>40 ELEVATED</span><span>65 HIGH</span><span>85 CRITICAL</span><span>100</span>
            </div>
          </div>

          {/* Suspect Re-ID Profile Card */}
          <div className="rounded-lg border border-slate-800 bg-[#0b0f19] p-4">
            <div className="text-[10px] font-mono text-slate-500 mb-3 tracking-wider">SUSPECT RE-ID PROFILE</div>
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-lg bg-[#111827] border border-slate-700 flex items-center justify-center text-3xl flex-shrink-0">
                {OBJ_ICONS[dossier.suspect_profile.object_class] || "👤"}
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-sky-400">TRACK #{dossier.suspect_profile.track_id}</span>
                  <span className="text-[9px] font-mono bg-sky-950 text-sky-400 border border-sky-700 rounded px-1.5 py-0.5">
                    {dossier.suspect_profile.object_class.toUpperCase()}
                  </span>
                  {dossier.suspect_profile.is_ir_night_mode && (
                    <span className="text-[9px] font-mono bg-purple-950 text-purple-400 border border-purple-700 rounded px-1.5 py-0.5">
                      🌙 IR NIGHT
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] font-mono">
                  <div><span className="text-slate-500">SIGHTINGS:</span> <span className="text-slate-300 font-bold">{dossier.suspect_profile.total_sightings}</span></div>
                  <div><span className="text-slate-500">CAMERAS:</span> <span className="text-slate-300 font-bold">{dossier.suspect_profile.cameras_traversed.length}</span></div>
                  {Object.entries(dossier.suspect_profile.confirmed_attributes).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-slate-500">{k.toUpperCase().replace(/_/g, " ")}:</span>{" "}
                      <span className="text-emerald-400 font-bold">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Camera Handoff Chain (Chronological Sightings) */}
          <div>
            <div className="text-[10px] font-mono text-slate-500 mb-2 tracking-wider">CAMERA HANDOFF CHAIN (CHRONOLOGICAL)</div>
            <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
              {dossier.chronological_sightings.map((s, i) => (
                <React.Fragment key={s.camera_id}>
                  <div className="flex-shrink-0 w-48 bg-[#111827] rounded-lg border border-slate-800 p-3">
                    <div className="text-[10px] font-mono font-bold text-sky-400 mb-1">{s.camera_id}</div>
                    <div className="space-y-1 text-[9px] font-mono">
                      <div className="flex justify-between"><span className="text-slate-500">FIRST SEEN</span><span className="text-slate-300">{formatTimestamp(s.first_seen_sec)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">LAST SEEN</span><span className="text-slate-300">{formatTimestamp(s.last_seen_sec)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">DURATION</span><span className="text-emerald-400 font-bold">{s.duration_sec.toFixed(1)}s</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">SPEED</span><span className="text-amber-400 font-bold">{s.estimated_speed_kmh.toFixed(0)} km/h</span></div>
                    </div>
                  </div>
                  {i < dossier.chronological_sightings.length - 1 && (
                    <div className="flex items-center px-2 text-slate-600 text-lg font-mono">→</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Tripwire Breach Logs */}
          <div>
            <div className="text-[10px] font-mono text-slate-500 mb-2 tracking-wider">TRIPWIRE BREACH LOG</div>
            <div className="space-y-1.5">
              {dossier.breach_logs.map((b) => (
                <div
                  key={b.breach_id}
                  className={`rounded border p-2.5 text-[9px] font-mono ${
                    b.severity === "CRITICAL" || b.severity === "HIGH"
                      ? "bg-red-950/60 border-red-500/50 text-red-400"
                      : "bg-amber-950/50 border-amber-600/40 text-amber-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">{b.breach_id}</span>
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">{b.severity}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-slate-400">
                    <div><span className="text-slate-500">CAM:</span> {b.camera_id}</div>
                    <div><span className="text-slate-500">TIME:</span> {formatTimestamp(b.timestamp_sec)}</div>
                    <div><span className="text-slate-500">DWELL:</span> {b.dwell_time_sec.toFixed(1)}s</div>
                    <div><span className="text-slate-500">ZONE:</span> {b.zone_name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Seal */}
          <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-4">
            <div className="text-[10px] font-mono text-emerald-500 mb-2 tracking-wider">🔒 CRYPTOGRAPHIC EVIDENCE SEAL</div>
            <div className="space-y-2 text-[9px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">CASE ID</span>
                <span className="text-slate-300 font-bold">{dossier.case_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GENERATED</span>
                <span className="text-slate-300">{dossier.generated_at_utc}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">STANDARD</span>
                <span className="text-emerald-400 text-[8px] max-w-[280px] text-right">{dossier.admissibility_standard}</span>
              </div>
              <div>
                <span className="text-slate-500">SHA-256 SEAL</span>
                <div className="mt-1 bg-[#070a12] rounded p-2 border border-emerald-900/60 break-all text-emerald-400 font-bold tracking-wider text-[10px]">
                  {dossier.evidence_seal_sha256}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForensicSynopsisDossier;
