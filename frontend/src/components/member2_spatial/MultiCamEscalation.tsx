"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { TrackletRecord } from "@/types/contract";

// ============================================================================
// Types matching POST /api/spatial/multicam-handoff request/response
// ============================================================================

interface Point2D { x: number; y: number; }

interface ArrivalWindow {
  min_sec: number;
  max_sec: number;
  nominal_sec: number;
}

type AlertPriority = "PRIMARY_TARGET" | "SECONDARY_INTERCEPT" | "PERIPHERAL";

interface CandidateCameraHandoff {
  camera_id: string;
  camera_name: string;
  distance_meters: number;
  direction_alignment: number;
  expected_arrival_window: ArrivalWindow;
  handoff_probability: number;
  alert_priority: AlertPriority;
}

interface ExitVector {
  velocity_mps: number;
  velocity_kmh: number;
  heading_degrees: number;
  exit_edge: string;
  last_floorplan_coord: Point2D;
  last_observed_timestamp: number;
}

interface MultiCamHandoffResponse {
  track_id: string;
  origin_camera_id: string;
  floorplan_trajectory: { timestamp_sec: number; image_coord: Point2D; floorplan_coord: Point2D }[];
  exit_vector: ExitVector;
  ranked_candidate_cameras: CandidateCameraHandoff[];
  recommended_intercept_camera_id: string | null;
  status: string;
}

// ============================================================================
// Facility layout definition
// ============================================================================

interface CameraNode {
  id: string;
  name: string;
  shortName: string;
  x: number;  // SVG floorplan X
  y: number;  // SVG floorplan Y
  fovAngle: number;      // degrees FOV cone opening
  fovDirection: number;   // degrees, 0=right, counter-clockwise
  fovRadius: number;
  zone: string;
  color: string;
}

const CAMERAS: CameraNode[] = [
  { id: "CAM_01_GATE", name: "Main Campus Security Gate", shortName: "GATE", x: 120, y: 160, fovAngle: 70, fovDirection: 135, fovRadius: 80, zone: "ENTRY", color: "#38bdf8" },
  { id: "CAM_02_HOSTEL_RD", name: "Hostel Road Corridor", shortName: "HOSTEL", x: 340, y: 300, fovAngle: 60, fovDirection: 160, fovRadius: 75, zone: "TRANSIT", color: "#a78bfa" },
  { id: "CAM_03_NH48", name: "NH48 Highway Merge", shortName: "NH48", x: 600, y: 440, fovAngle: 80, fovDirection: 110, fovRadius: 90, zone: "PUBLIC", color: "#f59e0b" },
  { id: "CAM_04_WAREHOUSE", name: "Loading Bay & Dock", shortName: "DOCK", x: 130, y: 380, fovAngle: 65, fovDirection: 80, fovRadius: 70, zone: "RESTRICTED", color: "#ef4444" },
  { id: "CAM_05_NORTH_PERIMETER", name: "North Perimeter Fence", shortName: "FENCE", x: 180, y: 480, fovAngle: 90, fovDirection: 200, fovRadius: 85, zone: "HIGH_SECURITY", color: "#10b981" },
];

const CONNECTIONS: [string, string][] = [
  ["CAM_01_GATE", "CAM_02_HOSTEL_RD"],
  ["CAM_01_GATE", "CAM_04_WAREHOUSE"],
  ["CAM_02_HOSTEL_RD", "CAM_03_NH48"],
  ["CAM_02_HOSTEL_RD", "CAM_05_NORTH_PERIMETER"],
];

// ============================================================================
// Fallback simulation data
// ============================================================================

const FALLBACK_RESPONSE: MultiCamHandoffResponse = {
  track_id: "SUSPECT_42",
  origin_camera_id: "CAM_01_GATE",
  floorplan_trajectory: [
    { timestamp_sec: 100.0, image_coord: { x: 500, y: 400 }, floorplan_coord: { x: 140, y: 175 } },
    { timestamp_sec: 101.5, image_coord: { x: 800, y: 600 }, floorplan_coord: { x: 210, y: 230 } },
    { timestamp_sec: 103.0, image_coord: { x: 1100, y: 800 }, floorplan_coord: { x: 290, y: 285 } },
  ],
  exit_vector: {
    velocity_mps: 11.7,
    velocity_kmh: 42.0,
    heading_degrees: 145.0,
    exit_edge: "SOUTH_EAST",
    last_floorplan_coord: { x: 290, y: 285 },
    last_observed_timestamp: 103.0,
  },
  ranked_candidate_cameras: [
    {
      camera_id: "CAM_02_HOSTEL_RD",
      camera_name: "Hostel Road Corridor",
      distance_meters: 85.0,
      direction_alignment: 0.91,
      expected_arrival_window: { min_sec: 5.4, max_sec: 9.8, nominal_sec: 7.3 },
      handoff_probability: 0.72,
      alert_priority: "PRIMARY_TARGET",
    },
    {
      camera_id: "CAM_04_WAREHOUSE",
      camera_name: "Loading Bay & Dock",
      distance_meters: 120.0,
      direction_alignment: 0.35,
      expected_arrival_window: { min_sec: 7.7, max_sec: 13.9, nominal_sec: 10.3 },
      handoff_probability: 0.18,
      alert_priority: "PERIPHERAL",
    },
    {
      camera_id: "CAM_03_NH48",
      camera_name: "NH48 Highway Merge",
      distance_meters: 280.0,
      direction_alignment: 0.68,
      expected_arrival_window: { min_sec: 17.9, max_sec: 32.3, nominal_sec: 23.9 },
      handoff_probability: 0.08,
      alert_priority: "PERIPHERAL",
    },
  ],
  recommended_intercept_camera_id: "CAM_02_HOSTEL_RD",
  status: "SUCCESS_HANDOFF_PREDICTED",
};

// ============================================================================
// Helpers
// ============================================================================

const PRIORITY_STYLES: Record<AlertPriority, { bg: string; text: string; border: string; badge: string }> = {
  PRIMARY_TARGET:      { bg: "bg-red-950/80",    text: "text-red-400",    border: "border-red-500/60",    badge: "bg-red-500" },
  SECONDARY_INTERCEPT: { bg: "bg-amber-950/80",  text: "text-amber-400",  border: "border-amber-500/60",  badge: "bg-amber-500" },
  PERIPHERAL:          { bg: "bg-slate-900/80",  text: "text-slate-400",  border: "border-slate-700",     badge: "bg-slate-600" },
};

function fovArcPath(cx: number, cy: number, r: number, dirDeg: number, angleDeg: number): string {
  const halfAngle = angleDeg / 2;
  const startRad = ((dirDeg - halfAngle) * Math.PI) / 180;
  const endRad = ((dirDeg + halfAngle) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = angleDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function formatETA(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
}

// ============================================================================
// Component
// ============================================================================

export interface MultiCamEscalationProps {
  tracklets?: TrackletRecord[] | null;
  videoUrl?: string;
}

export const MultiCamEscalation: React.FC<MultiCamEscalationProps> = ({
  tracklets = null,
  videoUrl = "/sample_cctv_feed.mp4",
}) => {
  const [response, setResponse] = useState<MultiCamHandoffResponse>(FALLBACK_RESPONSE);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [etaCountdowns, setEtaCountdowns] = useState<Record<string, number>>({});
  const [animProgress, setAnimProgress] = useState(0);
  const [highlightedCam, setHighlightedCam] = useState<string | null>(FALLBACK_RESPONSE.recommended_intercept_camera_id);

  const hasRealTracklets = Boolean(tracklets && tracklets.length > 0);
  const activeTracklet = hasRealTracklets && tracklets ? tracklets[0] : null;

  // -- API call --
  const fetchHandoff = useCallback(async () => {
    setIsLoading(true);
    const realTraj = (activeTracklet && activeTracklet.trajectory && activeTracklet.trajectory.length > 0)
      ? activeTracklet.trajectory.map((pt) => ({
          timestamp_sec: pt.timestamp_sec,
          bbox: [pt.x1, pt.y1, pt.x2, pt.y2],
        }))
      : [
          { timestamp_sec: 100.0, bbox: [960, 500, 1000, 600] },
          { timestamp_sec: 101.5, bbox: [1050, 700, 1100, 850] },
          { timestamp_sec: 103.0, bbox: [1180, 900, 1240, 1050] },
        ];

    const body = {
      track_id: activeTracklet ? `TRACK_${activeTracklet.track_id}` : "SUSPECT_42",
      origin_camera_id: activeTracklet?.camera_id || response.origin_camera_id,
      trajectory: realTraj,
    };
    try {
      const res = await fetch("http://localhost:8000/api/spatial/multicam-handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data: MultiCamHandoffResponse = await res.json();
        setResponse(data);
        setHighlightedCam(data.recommended_intercept_camera_id);
      }
    } catch {
      setResponse(FALLBACK_RESPONSE);
    }
    setIsLoading(false);
  }, [activeTracklet, response.origin_camera_id]);

  // Auto-fetch on mount
  useEffect(() => { fetchHandoff(); }, []);

  // -- Trajectory animation --
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimProgress((prev) => (prev >= 1 ? 0 : prev + 0.008));
    }, 40);
    return () => clearInterval(timer);
  }, []);

  // -- ETA countdown timers --
  useEffect(() => {
    const initCountdowns: Record<string, number> = {};
    response.ranked_candidate_cameras.forEach((c) => {
      initCountdowns[c.camera_id] = c.expected_arrival_window.nominal_sec;
    });
    setEtaCountdowns(initCountdowns);

    const timer = setInterval(() => {
      setEtaCountdowns((prev) => {
        const next: Record<string, number> = {};
        Object.entries(prev).forEach(([k, v]) => {
          next[k] = Math.max(0, v - 0.5);
        });
        return next;
      });
    }, 500);
    return () => clearInterval(timer);
  }, [response]);

  // -- Interpolate trajectory point at animProgress --
  const trajPoints = response.floorplan_trajectory;
  const interpPoint = (() => {
    if (trajPoints.length < 2) return trajPoints[0]?.floorplan_coord || { x: 0, y: 0 };
    const totalLen = trajPoints.length - 1;
    const idx = animProgress * totalLen;
    const i = Math.floor(idx);
    const t = idx - i;
    const a = trajPoints[Math.min(i, totalLen)]?.floorplan_coord || { x: 0, y: 0 };
    const b = trajPoints[Math.min(i + 1, totalLen)]?.floorplan_coord || a;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  })();

  const getCam = (id: string) => CAMERAS.find((c) => c.id === id);

  return (
    <div className="w-full bg-[#070a12] text-slate-100 rounded-lg border border-slate-800/80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-[#0b0f19]/70">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-widest font-mono text-purple-400 uppercase">
            MULTI-CAM ESCALATION & HANDOFF
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHandoff}
            disabled={isLoading}
            className="px-2.5 py-1 text-[10px] font-mono font-bold rounded border bg-slate-900 border-slate-700 text-slate-400 hover:border-purple-500 hover:text-purple-400 transition disabled:opacity-40"
          >
            {isLoading ? "↻ COMPUTING…" : "↻ RE-EVALUATE"}
          </button>
          <div className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
            response.status === "SUCCESS_HANDOFF_PREDICTED"
              ? "bg-emerald-950 text-emerald-400 border border-emerald-700"
              : "bg-slate-900 text-slate-500 border border-slate-700"
          }`}>
            {response.status}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* SVG Floorplan */}
        <div className="flex-1 p-3">
          <svg
            viewBox="0 0 740 560"
            className="w-full h-auto rounded border border-slate-800 bg-[#0a0e18]"
          >
            {/* Background grid */}
            <defs>
              <pattern id="floorGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(100,116,139,0.06)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="740" height="560" fill="url(#floorGrid)" />

            {/* Connection lines */}
            {CONNECTIONS.map(([a, b], i) => {
              const ca = getCam(a);
              const cb = getCam(b);
              if (!ca || !cb) return null;
              return (
                <line
                  key={i}
                  x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}
                  stroke="rgba(100,116,139,0.15)"
                  strokeWidth="1"
                  strokeDasharray="6 4"
                />
              );
            })}

            {/* Camera FOV cones */}
            {CAMERAS.map((cam) => {
              const isOrigin = cam.id === response.origin_camera_id;
              const isTarget = cam.id === highlightedCam;
              const opacity = isOrigin ? 0.18 : isTarget ? 0.12 : 0.05;
              return (
                <path
                  key={`fov-${cam.id}`}
                  d={fovArcPath(cam.x, cam.y, cam.fovRadius, cam.fovDirection, cam.fovAngle)}
                  fill={cam.color}
                  opacity={opacity}
                  stroke={cam.color}
                  strokeWidth={isTarget ? 1.5 : 0.5}
                  strokeOpacity={isTarget ? 0.5 : 0.2}
                />
              );
            })}

            {/* Trajectory path */}
            {trajPoints.length > 1 && (
              <polyline
                points={trajPoints.map((p) => `${p.floorplan_coord.x},${p.floorplan_coord.y}`).join(" ")}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="6 3"
                opacity="0.6"
              />
            )}

            {/* Predicted handoff vector (exit direction) */}
            {(() => {
              const last = trajPoints[trajPoints.length - 1]?.floorplan_coord;
              const target = getCam(response.recommended_intercept_camera_id || "");
              if (!last || !target) return null;
              return (
                <line
                  x1={last.x} y1={last.y}
                  x2={target.x} y2={target.y}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.6"
                  markerEnd="url(#arrowRed)"
                />
              );
            })()}
            <defs>
              <marker id="arrowRed" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
              </marker>
            </defs>

            {/* Animated suspect dot */}
            <circle
              cx={interpPoint.x}
              cy={interpPoint.y}
              r="6"
              fill="#38bdf8"
              stroke="#0ea5e9"
              strokeWidth="2"
            >
              <animate attributeName="r" values="5;8;5" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.6;1" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <circle cx={interpPoint.x} cy={interpPoint.y} r="18" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3">
              <animate attributeName="r" values="10;22;10" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
            </circle>

            {/* Suspect HUD label */}
            <text
              x={interpPoint.x + 14}
              y={interpPoint.y - 10}
              fill="#38bdf8"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              #{response.track_id} | {response.exit_vector.velocity_kmh.toFixed(0)} km/h
            </text>

            {/* Camera nodes */}
            {CAMERAS.map((cam) => {
              const isOrigin = cam.id === response.origin_camera_id;
              const isTarget = cam.id === highlightedCam;
              const isCandidate = response.ranked_candidate_cameras.some((c) => c.camera_id === cam.id);
              const eta = etaCountdowns[cam.id];

              return (
                <g
                  key={cam.id}
                  onClick={() => setSelectedCamera(cam.id === selectedCamera ? null : cam.id)}
                  className="cursor-pointer"
                >
                  {/* Node circle */}
                  <circle
                    cx={cam.x} cy={cam.y} r={isTarget ? 14 : 10}
                    fill={isOrigin ? cam.color : "#111827"}
                    stroke={isTarget ? "#ef4444" : cam.color}
                    strokeWidth={isTarget ? 2.5 : 1.5}
                    opacity={isOrigin || isTarget ? 1 : 0.7}
                  />
                  {isTarget && (
                    <circle cx={cam.x} cy={cam.y} r="20" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4">
                      <animate attributeName="r" values="16;24;16" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0;0.5" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Camera icon text */}
                  <text
                    x={cam.x} y={cam.y + 3}
                    textAnchor="middle"
                    fill={isOrigin ? "#0a0e18" : cam.color}
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    📷
                  </text>

                  {/* Label below */}
                  <text
                    x={cam.x} y={cam.y + 26}
                    textAnchor="middle"
                    fill={isTarget ? "#ef4444" : "#94a3b8"}
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight={isTarget ? "bold" : "normal"}
                  >
                    {cam.shortName}
                  </text>

                  {/* ETA countdown badge for candidates */}
                  {isCandidate && eta !== undefined && (
                    <g>
                      <rect
                        x={cam.x + 16} y={cam.y - 18}
                        width={48} height={16}
                        rx="3"
                        fill={isTarget ? "rgba(239,68,68,0.25)" : "rgba(30,41,59,0.9)"}
                        stroke={isTarget ? "#ef4444" : "#475569"}
                        strokeWidth="0.8"
                      />
                      <text
                        x={cam.x + 40} y={cam.y - 7}
                        textAnchor="middle"
                        fill={isTarget ? "#fca5a5" : "#94a3b8"}
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        ETA {formatETA(eta)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Heading direction compass arrow */}
            {(() => {
              const last = response.exit_vector.last_floorplan_coord;
              const headRad = (response.exit_vector.heading_degrees * Math.PI) / 180;
              const arrowLen = 35;
              const endX = last.x + arrowLen * Math.sin(headRad);
              const endY = last.y + arrowLen * Math.cos(headRad);
              return (
                <line
                  x1={last.x} y1={last.y} x2={endX} y2={endY}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  markerEnd="url(#arrowAmber)"
                  opacity="0.7"
                />
              );
            })()}
            <defs>
              <marker id="arrowAmber" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
              </marker>
            </defs>

            {/* Legend */}
            <g>
              <rect x="570" y="20" width="155" height="90" rx="4" fill="rgba(11,15,25,0.85)" stroke="#334155" strokeWidth="0.5" />
              <text x="580" y="36" fill="#64748b" fontSize="8" fontFamily="monospace" fontWeight="bold">FACILITY LEGEND</text>
              <circle cx="585" cy="48" r="4" fill="#38bdf8" />
              <text x="595" y="51" fill="#94a3b8" fontSize="7" fontFamily="monospace">SUSPECT TRAJECTORY</text>
              <line x1="578" y1="62" x2="598" y2="62" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x="604" y="65" fill="#94a3b8" fontSize="7" fontFamily="monospace">PREDICTED HANDOFF</text>
              <line x1="578" y1="76" x2="598" y2="76" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="604" y="79" fill="#94a3b8" fontSize="7" fontFamily="monospace">HEADING VECTOR</text>
              <rect x="578" y="86" width="16" height="8" rx="1" fill="rgba(56,189,248,0.1)" stroke="#38bdf8" strokeWidth="0.5" />
              <text x="600" y="93" fill="#94a3b8" fontSize="7" fontFamily="monospace">FOV CONE</text>
            </g>
          </svg>
        </div>

        {/* Right Panel: Candidate Camera Ranking & Exit Vector Telemetry */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800/60 flex flex-col">
          {/* Exit Vector Summary */}
          <div className="px-4 py-3 border-b border-slate-800/60 bg-[#0b0f19]/50">
            <div className="text-[10px] font-mono text-slate-500 mb-2 tracking-wider">EXIT VECTOR TELEMETRY</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#111827] rounded p-2 border border-slate-800">
                <div className="text-[9px] font-mono text-slate-500">VELOCITY</div>
                <div className="text-sm font-mono font-bold text-sky-400">{response.exit_vector.velocity_kmh.toFixed(1)} km/h</div>
              </div>
              <div className="bg-[#111827] rounded p-2 border border-slate-800">
                <div className="text-[9px] font-mono text-slate-500">HEADING</div>
                <div className="text-sm font-mono font-bold text-amber-400">{response.exit_vector.heading_degrees.toFixed(1)}°</div>
              </div>
              <div className="bg-[#111827] rounded p-2 border border-slate-800">
                <div className="text-[9px] font-mono text-slate-500">EXIT EDGE</div>
                <div className="text-xs font-mono font-bold text-red-400">{response.exit_vector.exit_edge}</div>
              </div>
              <div className="bg-[#111827] rounded p-2 border border-slate-800">
                <div className="text-[9px] font-mono text-slate-500">LAST SEEN</div>
                <div className="text-xs font-mono font-bold text-slate-300">{response.exit_vector.last_observed_timestamp.toFixed(1)}s</div>
              </div>
            </div>
          </div>

          {/* Ranked Candidate Cameras */}
          <div className="px-4 py-3 border-b border-slate-800/60">
            <div className="text-[10px] font-mono text-slate-500 mb-2 tracking-wider">PREDICTED HANDOFF RANKING</div>
            <div className="space-y-2">
              {response.ranked_candidate_cameras.map((cam, i) => {
                const style = PRIORITY_STYLES[cam.alert_priority];
                const eta = etaCountdowns[cam.camera_id] ?? cam.expected_arrival_window.nominal_sec;
                const isRecommended = cam.camera_id === response.recommended_intercept_camera_id;
                return (
                  <div
                    key={cam.camera_id}
                    className={`rounded border p-2.5 transition-all cursor-pointer ${style.bg} ${style.border} ${
                      highlightedCam === cam.camera_id ? "ring-1 ring-red-400/50" : ""
                    }`}
                    onClick={() => setHighlightedCam(cam.camera_id)}
                    onMouseEnter={() => setHighlightedCam(cam.camera_id)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono font-bold ${style.text}`}>
                          #{i + 1} {cam.camera_name}
                        </span>
                      </div>
                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${style.badge} text-white`}>
                        {cam.alert_priority.replace("_", " ")}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
                      <div>
                        <span className="text-slate-500">PROB</span>
                        <div className={`font-bold ${style.text}`}>{(cam.handoff_probability * 100).toFixed(0)}%</div>
                      </div>
                      <div>
                        <span className="text-slate-500">DIST</span>
                        <div className="font-bold text-slate-300">{cam.distance_meters.toFixed(0)}m</div>
                      </div>
                      <div>
                        <span className="text-slate-500">ETA</span>
                        <div className={`font-bold tabular-nums ${eta < 3 ? "text-red-400 animate-pulse" : "text-slate-300"}`}>
                          {formatETA(eta)}
                        </div>
                      </div>
                    </div>
                    {/* Probability bar */}
                    <div className="mt-1.5 w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cam.alert_priority === "PRIMARY_TARGET" ? "bg-red-500" :
                          cam.alert_priority === "SECONDARY_INTERCEPT" ? "bg-amber-500" : "bg-slate-600"
                        }`}
                        style={{ width: `${cam.handoff_probability * 100}%` }}
                      />
                    </div>
                    {/* Switch camera button */}
                    {isRecommended && (
                      <button className="mt-2 w-full py-1.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-mono font-bold hover:bg-red-500/30 transition">
                        ⚡ SWITCH TO {cam.camera_name.toUpperCase()}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Direction Alignment */}
          <div className="px-4 py-3">
            <div className="text-[10px] font-mono text-slate-500 mb-2 tracking-wider">DIRECTION ALIGNMENT</div>
            {response.ranked_candidate_cameras.map((cam) => (
              <div key={cam.camera_id} className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-mono text-slate-400 w-14 truncate">{getCam(cam.camera_id)?.shortName || cam.camera_id}</span>
                <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      cam.direction_alignment > 0.7 ? "bg-emerald-500" :
                      cam.direction_alignment > 0.3 ? "bg-amber-500" : "bg-slate-600"
                    }`}
                    style={{ width: `${Math.max(5, ((cam.direction_alignment + 1) / 2) * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-slate-400 w-10 text-right">{cam.direction_alignment.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiCamEscalation;
