"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// Types matching POST /api/spatial/tripwire-check request/response
// ============================================================================

interface Point2D { x: number; y: number; }

interface DirectionalTripwire {
  name: string;
  start: Point2D;
  end: Point2D;
  allowed_direction?: Point2D | null;
}

interface TrajectoryPointInput {
  timestamp_sec: number;
  bbox?: number[] | null;
  point?: Point2D | null;
}

interface TripwireCrossingLog {
  tripwire_name: string;
  timestamp_sec: number;
  crossing_direction: string;
  breach: boolean;
  intersection_point: Point2D;
}

type IntrusionState = "OUTSIDE" | "ENTERED" | "INSIDE" | "EXITED";
type Severity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface TripwireCheckResponse {
  track_id: string;
  camera_id: string;
  zone_name: string;
  intrusion_state: IntrusionState;
  is_breached: boolean;
  dwell_time_sec: number;
  severity: Severity;
  tripwire_crossings: TripwireCrossingLog[];
  alert_message: string | null;
  entry_timestamp_sec: number | null;
  exit_timestamp_sec: number | null;
  inside_points_count: number;
  total_points_count: number;
}

// ============================================================================
// Drawing modes
// ============================================================================

type DrawMode = "polygon" | "tripwire" | "simulate";

// ============================================================================
// Simulation fallback data
// ============================================================================

const FALLBACK_POLYGON: Point2D[] = [
  { x: 120, y: 140 }, { x: 520, y: 110 }, { x: 580, y: 420 }, { x: 100, y: 440 },
];

const FALLBACK_TRIPWIRE: DirectionalTripwire = {
  name: "GATE_PERIMETER_LINE",
  start: { x: 80, y: 280 },
  end: { x: 620, y: 280 },
};

const FALLBACK_TRAJECTORY: TrajectoryPointInput[] = [
  { timestamp_sec: 0.0, point: { x: 60, y: 80 } },
  { timestamp_sec: 0.8, point: { x: 160, y: 160 } },
  { timestamp_sec: 1.5, point: { x: 250, y: 240 } },
  { timestamp_sec: 2.2, point: { x: 320, y: 310 } },
  { timestamp_sec: 3.0, point: { x: 380, y: 350 } },
  { timestamp_sec: 4.2, point: { x: 420, y: 370 } },
  { timestamp_sec: 5.5, point: { x: 440, y: 380 } },
  { timestamp_sec: 7.0, point: { x: 500, y: 400 } },
  { timestamp_sec: 8.5, point: { x: 560, y: 460 } },
];

const FALLBACK_RESPONSE: TripwireCheckResponse = {
  track_id: "42",
  camera_id: "CAM_01_GATE",
  zone_name: "RESTRICTED_SECURITY_ZONE",
  intrusion_state: "ENTERED",
  is_breached: true,
  dwell_time_sec: 5.3,
  severity: "HIGH",
  tripwire_crossings: [
    {
      tripwire_name: "GATE_PERIMETER_LINE",
      timestamp_sec: 2.2,
      crossing_direction: "FORWARD",
      breach: true,
      intersection_point: { x: 310, y: 280 },
    },
  ],
  alert_message: "HIGH ALERT: Persistent intrusion by Track #42 in RESTRICTED_SECURITY_ZONE (5.3s).",
  entry_timestamp_sec: 1.5,
  exit_timestamp_sec: null,
  inside_points_count: 6,
  total_points_count: 9,
};

// ============================================================================
// Severity color map
// ============================================================================

const SEVERITY_COLORS: Record<Severity, { bg: string; text: string; border: string; glow: string }> = {
  NONE:     { bg: "bg-slate-900",    text: "text-slate-400",   border: "border-slate-700",   glow: "" },
  LOW:      { bg: "bg-emerald-950",  text: "text-emerald-400", border: "border-emerald-700", glow: "shadow-[0_0_12px_rgba(16,185,129,0.2)]" },
  MEDIUM:   { bg: "bg-amber-950",    text: "text-amber-400",   border: "border-amber-600",   glow: "shadow-[0_0_16px_rgba(245,158,11,0.3)]" },
  HIGH:     { bg: "bg-red-950",      text: "text-red-400",     border: "border-red-500",     glow: "shadow-[0_0_24px_rgba(239,68,68,0.4)]" },
  CRITICAL: { bg: "bg-red-950",      text: "text-red-300",     border: "border-red-400",     glow: "shadow-[0_0_32px_rgba(239,68,68,0.6)]" },
};

const STATE_LABEL: Record<IntrusionState, { icon: string; label: string }> = {
  OUTSIDE: { icon: "🟢", label: "CLEAR — NO INTRUSION" },
  ENTERED: { icon: "🟡", label: "BREACH — SUBJECT ENTERED ZONE" },
  INSIDE:  { icon: "🔴", label: "ACTIVE — SUBJECT INSIDE ZONE" },
  EXITED:  { icon: "🔵", label: "EXITED — SUBJECT LEFT ZONE" },
};

// ============================================================================
// Component
// ============================================================================

export const PolygonTripwire: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const [drawMode, setDrawMode] = useState<DrawMode>("simulate");
  const [polygonVerts, setPolygonVerts] = useState<Point2D[]>(FALLBACK_POLYGON);
  const [tripwire, setTripwire] = useState<DirectionalTripwire>(FALLBACK_TRIPWIRE);
  const [tripwireStart, setTripwireStart] = useState<Point2D | null>(null);
  const [trajectory] = useState<TrajectoryPointInput[]>(FALLBACK_TRAJECTORY);

  const [response, setResponse] = useState<TripwireCheckResponse>(FALLBACK_RESPONSE);
  const [isLoading, setIsLoading] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [isSimRunning, setIsSimRunning] = useState(true);
  const [alertLog, setAlertLog] = useState<{ time: string; msg: string; sev: Severity }[]>([]);

  // Live simulation dwell counter
  const [liveDwell, setLiveDwell] = useState(0);

  // -- API Call --
  const evaluateTripwire = useCallback(async (overrideTrajectory?: TrajectoryPointInput[]) => {
    setIsLoading(true);
    const body = {
      track_id: "42",
      camera_id: "CAM_01_GATE",
      polygon_vertices: polygonVerts,
      directional_tripwires: [tripwire],
      trajectory: overrideTrajectory || trajectory,
      evaluation_point: "point",
      min_dwell_sec: 1.5,
      zone_name: "RESTRICTED_SECURITY_ZONE",
      object_class: "person",
    };
    try {
      const res = await fetch("http://localhost:8000/api/spatial/tripwire-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data: TripwireCheckResponse = await res.json();
        setResponse(data);
        if (data.alert_message) {
          setAlertLog((prev) => [
            { time: new Date().toLocaleTimeString(), msg: data.alert_message!, sev: data.severity },
            ...prev.slice(0, 19),
          ]);
        }
      }
    } catch {
      // Fallback: use simulation data
      setResponse(FALLBACK_RESPONSE);
    }
    setIsLoading(false);
  }, [polygonVerts, tripwire, trajectory]);

  // -- Simulation tick --
  useEffect(() => {
    if (!isSimRunning) return;
    const timer = setInterval(() => {
      setSimStep((prev) => {
        const next = (prev + 1) % trajectory.length;
        if (next === 0) setLiveDwell(0);
        // Check if the simulation point is inside the polygon
        const pt = trajectory[next].point;
        if (pt) {
          const inside = isPointInPoly(pt, polygonVerts);
          if (inside) {
            setLiveDwell((d) => d + 0.6);
          }
        }
        // Trigger API evaluation at each step with the partial trajectory
        const partial = trajectory.slice(0, next + 1);
        evaluateTripwire(partial);
        return next;
      });
    }, 600);
    return () => clearInterval(timer);
  }, [isSimRunning, trajectory, polygonVerts, evaluateTripwire]);

  // -- Point-in-polygon (client-side for visual feedback) --
  function isPointInPoly(pt: Point2D, verts: Point2D[]): boolean {
    let inside = false;
    const n = verts.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const vi = verts[i], vj = verts[j];
      if ((vi.y > pt.y) !== (vj.y > pt.y) &&
          pt.x < (vj.x - vi.x) * (pt.y - vi.y) / (vj.y - vi.y) + vi.x) {
        inside = !inside;
      }
    }
    return inside;
  }

  // -- Canvas rendering with requestAnimationFrame --
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // -- Background grid --
      ctx.strokeStyle = "rgba(100, 116, 139, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // -- Severity-dependent zone color --
      const sev = response.severity;
      let fillColor = "rgba(16, 185, 129, 0.08)";
      let strokeColor = "rgba(16, 185, 129, 0.6)";
      if (sev === "MEDIUM" || sev === "LOW") {
        fillColor = "rgba(245, 158, 11, 0.10)";
        strokeColor = "rgba(245, 158, 11, 0.7)";
      } else if (sev === "HIGH" || sev === "CRITICAL") {
        const pulse = 0.12 + 0.08 * Math.sin(Date.now() / 200);
        fillColor = `rgba(239, 68, 68, ${pulse})`;
        strokeColor = `rgba(239, 68, 68, ${0.7 + 0.3 * Math.sin(Date.now() / 150)})`;
      }

      // -- Draw polygon zone --
      if (polygonVerts.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(polygonVerts[0].x, polygonVerts[0].y);
        polygonVerts.forEach((v) => ctx.lineTo(v.x, v.y));
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // -- Draw polygon vertices --
      polygonVerts.forEach((v, i) => {
        ctx.beginPath();
        ctx.arc(v.x, v.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#38bdf8" : "#94a3b8";
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(148,163,184,0.7)";
        ctx.font = "9px monospace";
        ctx.fillText(`V${i}`, v.x + 8, v.y - 6);
      });

      // -- Draw directional tripwire --
      ctx.beginPath();
      ctx.moveTo(tripwire.start.x, tripwire.start.y);
      ctx.lineTo(tripwire.end.x, tripwire.end.y);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow head
      const angle = Math.atan2(tripwire.end.y - tripwire.start.y, tripwire.end.x - tripwire.start.x);
      const arrowLen = 12;
      ctx.beginPath();
      ctx.moveTo(tripwire.end.x, tripwire.end.y);
      ctx.lineTo(tripwire.end.x - arrowLen * Math.cos(angle - 0.4), tripwire.end.y - arrowLen * Math.sin(angle - 0.4));
      ctx.moveTo(tripwire.end.x, tripwire.end.y);
      ctx.lineTo(tripwire.end.x - arrowLen * Math.cos(angle + 0.4), tripwire.end.y - arrowLen * Math.sin(angle + 0.4));
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tripwire label
      const midX = (tripwire.start.x + tripwire.end.x) / 2;
      const midY = (tripwire.start.y + tripwire.end.y) / 2;
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 9px monospace";
      ctx.fillText("▲ TRIPWIRE", midX - 32, midY - 10);

      // -- Draw trajectory trail --
      const activePts = trajectory.slice(0, simStep + 1);
      if (activePts.length > 1) {
        ctx.beginPath();
        const first = activePts[0].point!;
        ctx.moveTo(first.x, first.y);
        activePts.forEach((p) => {
          if (p.point) ctx.lineTo(p.point.x, p.point.y);
        });
        ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // -- Draw trajectory dots (past = dim, current = bright) --
      activePts.forEach((p, i) => {
        if (!p.point) return;
        const isCurrent = i === activePts.length - 1;
        const inside = isPointInPoly(p.point, polygonVerts);

        ctx.beginPath();
        ctx.arc(p.point.x, p.point.y, isCurrent ? 7 : 3, 0, Math.PI * 2);

        if (isCurrent) {
          ctx.fillStyle = inside ? "#ef4444" : "#38bdf8";
          ctx.shadowColor = inside ? "rgba(239,68,68,0.8)" : "rgba(56,189,248,0.6)";
          ctx.shadowBlur = 14;
        } else {
          ctx.fillStyle = inside ? "rgba(239,68,68,0.4)" : "rgba(56,189,248,0.25)";
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // -- Current point HUD label --
      const curr = activePts[activePts.length - 1]?.point;
      if (curr) {
        const inside = isPointInPoly(curr, polygonVerts);
        const label = inside ? `⚠ INSIDE ZONE [${liveDwell.toFixed(1)}s]` : `● TRACKING [${simStep}/${trajectory.length - 1}]`;
        ctx.fillStyle = inside ? "#ef4444" : "#38bdf8";
        ctx.font = "bold 10px monospace";
        ctx.fillText(label, curr.x + 12, curr.y - 10);
      }

      // -- Crossing intersection markers --
      response.tripwire_crossings.forEach((c) => {
        ctx.beginPath();
        ctx.arc(c.intersection_point.x, c.intersection_point.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "rgba(239,68,68,0.25)";
        ctx.fill();

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 8px monospace";
        ctx.fillText("✕ CROSS", c.intersection_point.x + 12, c.intersection_point.y - 4);
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [polygonVerts, tripwire, trajectory, simStep, response, liveDwell]);

  // -- Canvas click handler for drawing --
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (drawMode === "polygon") {
      setPolygonVerts((prev) => [...prev, { x, y }]);
    } else if (drawMode === "tripwire") {
      if (!tripwireStart) {
        setTripwireStart({ x, y });
      } else {
        setTripwire({ name: "CUSTOM_TRIPWIRE", start: tripwireStart, end: { x, y } });
        setTripwireStart(null);
        setDrawMode("simulate");
      }
    }
  };

  const sevStyle = SEVERITY_COLORS[response.severity];
  const stateInfo = STATE_LABEL[response.intrusion_state];

  return (
    <div className="w-full bg-[#070a12] text-slate-100 rounded-lg border border-slate-800/80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-[#0b0f19]/70">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-widest font-mono text-sky-400 uppercase">
            POLYGON TRIPWIRE ENGINE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setDrawMode("polygon"); setPolygonVerts([]); }}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded border transition ${
              drawMode === "polygon"
                ? "bg-sky-500/20 border-sky-400 text-sky-300"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            ✏ DRAW ZONE
          </button>
          <button
            onClick={() => setDrawMode("tripwire")}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded border transition ${
              drawMode === "tripwire"
                ? "bg-amber-500/20 border-amber-400 text-amber-300"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            ▲ TRIPWIRE
          </button>
          <button
            onClick={() => {
              setDrawMode("simulate");
              setPolygonVerts(FALLBACK_POLYGON);
              setTripwire(FALLBACK_TRIPWIRE);
              setSimStep(0);
              setLiveDwell(0);
              setIsSimRunning(true);
            }}
            className="px-2.5 py-1 text-[10px] font-mono font-bold rounded border bg-slate-900 border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-400 transition"
          >
            ↻ RESET
          </button>
          <button
            onClick={() => setIsSimRunning((r) => !r)}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded border transition ${
              isSimRunning
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                : "bg-slate-900 border-slate-700 text-slate-500"
            }`}
          >
            {isSimRunning ? "⏸ PAUSE" : "▶ RUN"}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Canvas */}
        <div className="relative flex-1 p-3">
          <canvas
            ref={canvasRef}
            width={700}
            height={520}
            onClick={handleCanvasClick}
            className={`w-full h-auto rounded border bg-[#0a0e18] ${
              drawMode !== "simulate" ? "cursor-crosshair" : "cursor-default"
            } ${sevStyle.border} ${sevStyle.glow} transition-all duration-500`}
          />
          {/* Drawing mode indicator */}
          {drawMode !== "simulate" && (
            <div className="absolute top-5 left-5 bg-sky-500/20 border border-sky-400 rounded px-2.5 py-1 text-[10px] font-mono text-sky-300 animate-pulse">
              {drawMode === "polygon" ? "CLICK TO ADD VERTICES (close polygon with Reset)" : "CLICK START → END OF TRIPWIRE LINE"}
            </div>
          )}
          {/* Loading spinner */}
          {isLoading && (
            <div className="absolute top-5 right-5 flex items-center gap-1.5 bg-[#0b0f19]/90 rounded px-2 py-1 border border-slate-700">
              <div className="w-2.5 h-2.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-[9px] font-mono text-sky-400">EVALUATING</span>
            </div>
          )}
        </div>

        {/* Status Panel */}
        <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-800/60 flex flex-col">
          {/* Intrusion State Badge */}
          <div className={`px-4 py-3 border-b border-slate-800/60 ${sevStyle.bg} transition-colors duration-700`}>
            <div className="text-[10px] font-mono text-slate-500 mb-1">INTRUSION STATE</div>
            <div className={`flex items-center gap-2 text-sm font-bold font-mono ${sevStyle.text}`}>
              <span className="text-base">{stateInfo.icon}</span>
              <span>{stateInfo.label}</span>
            </div>
          </div>

          {/* Telemetry Metrics */}
          <div className="px-4 py-3 border-b border-slate-800/60 space-y-2.5">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-500">SEVERITY</span>
              <span className={`font-bold ${sevStyle.text}`}>{response.severity}</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-500">DWELL TIME</span>
              <span className={`font-bold tabular-nums ${
                response.dwell_time_sec > 5 ? "text-red-400" : response.dwell_time_sec > 2 ? "text-amber-400" : "text-emerald-400"
              }`}>
                {liveDwell.toFixed(1)}s / {response.dwell_time_sec.toFixed(1)}s
              </span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-500">POINTS INSIDE</span>
              <span className="text-slate-300 font-bold">{response.inside_points_count} / {response.total_points_count}</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-500">CROSSINGS</span>
              <span className="text-slate-300 font-bold">{response.tripwire_crossings.length}</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-500">ZONE</span>
              <span className="text-sky-400 font-bold truncate max-w-[120px]">{response.zone_name}</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-500">TRACK ID</span>
              <span className="text-slate-300 font-bold">#{response.track_id}</span>
            </div>
          </div>

          {/* Dwell time bar */}
          <div className="px-4 py-3 border-b border-slate-800/60">
            <div className="text-[10px] font-mono text-slate-500 mb-1.5">DWELL PRESSURE</div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  liveDwell > 10 ? "bg-red-500 animate-pulse" : liveDwell > 5 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, (liveDwell / 15) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[8px] font-mono text-slate-600">
              <span>0s</span><span>5s</span><span>10s</span><span>15s</span>
            </div>
          </div>

          {/* Alert Log */}
          <div className="flex-1 px-4 py-3 overflow-y-auto max-h-48">
            <div className="text-[10px] font-mono text-slate-500 mb-2">BREACH ALERT LOG</div>
            {alertLog.length === 0 ? (
              <div className="text-[10px] font-mono text-slate-600 italic">No breaches detected yet…</div>
            ) : (
              <div className="space-y-1.5">
                {alertLog.map((log, i) => (
                  <div key={i} className={`text-[9px] font-mono p-1.5 rounded border ${SEVERITY_COLORS[log.sev].bg} ${SEVERITY_COLORS[log.sev].border}`}>
                    <span className="text-slate-500">{log.time}</span>
                    <span className={`ml-1.5 ${SEVERITY_COLORS[log.sev].text}`}>{log.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolygonTripwire;
