"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  ShieldAlert, 
  Crosshair, 
  RefreshCw, 
  CheckCircle2, 
  MapPin, 
  Layers, 
  AlertTriangle,
  Clock,
  Compass
} from "lucide-react";
import { TripwireResult, TrackletRecord } from "@/types/contract";

export const PolygonTripwireCanvas: React.FC = () => {
  // Default Polygon: Perimeter Gate Zone
  const [points, setPoints] = useState<[number, number][]>([
    [100, 250],
    [520, 220],
    [680, 500],
    [140, 520],
  ]);
  const [selectedCamera, setSelectedCamera] = useState("CAM_01_GATE");
  const [minDwellSec, setMinDwellSec] = useState<number>(1.0);
  const [result, setResult] = useState<TripwireResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("gate");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tactical Zone Presets
  const applyPreset = (preset: "gate" | "dock" | "walkway") => {
    setActivePreset(preset);
    if (preset === "gate") {
      setSelectedCamera("CAM_01_GATE");
      setPoints([
        [100, 250],
        [520, 220],
        [680, 500],
        [140, 520],
      ]);
    } else if (preset === "dock") {
      setSelectedCamera("CAM_02_HOSTEL_RD");
      setPoints([
        [200, 180],
        [600, 180],
        [600, 420],
        [200, 420],
      ]);
    } else if (preset === "walkway") {
      setSelectedCamera("CAM_03_NH48");
      setPoints([
        [80, 360],
        [720, 320],
        [750, 480],
        [60, 520],
      ]);
    }
    setResult(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);
    setPoints((prev) => [...prev, [x, y]]);
    setActivePreset("custom");
  };

  const handleClear = () => {
    setPoints([]);
    setResult(null);
    setActivePreset("custom");
  };

  const handleEvaluate = async () => {
    if (points.length < 3) return;
    setIsEvaluating(true);
    try {
      const res = await fetch("http://localhost:8000/api/tripwire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_id: selectedCamera,
          polygon_points: points,
          min_dwell_sec: minDwellSec,
        }),
      });
      if (res.ok) {
        const data: TripwireResult = await res.json();
        setResult(data);
      }
    } catch {
      // Offline fallback simulation
      setResult({
        camera_id: selectedCamera,
        polygon_points: points,
        violated: true,
        violating_tracklets: [],
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Draw polygon and background trajectory on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Tactical Coordinate Grid
    ctx.strokeStyle = "rgba(30, 41, 59, 0.45)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw Polygon Perimeter Zone
    if (points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      if (points.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = result?.violated
          ? "rgba(239, 68, 68, 0.28)"
          : "rgba(56, 189, 248, 0.22)";
        ctx.fill();
      }

      ctx.strokeStyle = result?.violated ? "#ef4444" : "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw vertices
      points.forEach(([px, py], idx) => {
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = result?.violated ? "#ef4444" : "#38bdf8";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`V${idx + 1}`, px + 9, py - 6);
      });
    }

    // Draw Tracklet Trajectory #101
    const trajectory = [
      { x: 190, y: 415, label: "T0 (42.0s)" },
      { x: 280, y: 405, label: "T1 (42.8s)" },
      { x: 415, y: 390, label: "T2 (43.6s)" },
      { x: 560, y: 370, label: "T3 (44.5s)" },
      { x: 725, y: 350, label: "T4 (45.4s)" },
    ];

    ctx.beginPath();
    ctx.moveTo(trajectory[0].x, trajectory[0].y);
    for (let i = 1; i < trajectory.length; i++) {
      ctx.lineTo(trajectory[i].x, trajectory[i].y);
    }
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    trajectory.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#eab308";
      ctx.fill();
    });
  }, [points, result]);

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-sky-400" />
            Interactive Spatial Polygon Tripwire (Shapely Engine)
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Click canvas to define custom spatial boundaries. Shapely evaluates ray-casting point-in-polygon dwell times.
          </p>
        </div>

        {/* Preset Selector & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0b0f19] p-1 rounded border border-slate-800 text-[11px] font-mono">
            <button
              onClick={() => applyPreset("gate")}
              className={`px-2.5 py-1 rounded transition ${
                activePreset === "gate"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Gate Zone
            </button>
            <button
              onClick={() => applyPreset("dock")}
              className={`px-2.5 py-1 rounded transition ${
                activePreset === "dock"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Loading Bay
            </button>
            <button
              onClick={() => applyPreset("walkway")}
              className={`px-2.5 py-1 rounded transition ${
                activePreset === "walkway"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Perimeter Fence
            </button>
          </div>

          <button
            onClick={handleClear}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded transition flex items-center gap-1.5 border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            RESET
          </button>

          <button
            onClick={handleEvaluate}
            disabled={isEvaluating || points.length < 3}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-medium rounded transition disabled:opacity-50 flex items-center gap-1.5 shadow-[0_0_12px_rgba(56,189,248,0.3)]"
          >
            <Crosshair className="w-3.5 h-3.5" />
            {isEvaluating ? "COMPUTING SHAPELY INTERSECTIONS..." : "EVALUATE TRIPWIRE BREACH"}
          </button>
        </div>
      </div>

      {/* Interactive Tripwire Canvas Area */}
      <div className="relative border border-slate-800 rounded bg-[#0b0f19] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          onClick={handleCanvasClick}
          className="w-full aspect-video cursor-crosshair block"
        />

        {/* Tactical Canvas OSD */}
        <div className="absolute top-3 left-3 bg-[#0b0f19]/90 border border-slate-800 px-3 py-1.5 rounded text-[10px] font-mono text-slate-400 flex items-center gap-3">
          <span>ZONE VERTICES: {points.length}</span>
          <span>•</span>
          <span className="text-amber-400">YELLOW PATH: TRACK #101 TRAJECTORY</span>
          <span>•</span>
          <span>MIN DWELL: {minDwellSec}s</span>
        </div>

        {result && (
          <div
            className={`absolute bottom-3 right-3 px-3.5 py-2 rounded border font-mono text-xs flex items-center gap-2 ${
              result.violated
                ? "bg-red-950/90 border-red-500 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse"
                : "bg-emerald-950/90 border-emerald-500 text-emerald-300"
            }`}
          >
            {result.violated ? (
              <>
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span className="font-bold">
                  PERIMETER BREACH DETECTED ({result.violating_tracklets.length} TARGETS INTRUDED)
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>PERIMETER SECURE // ZERO INTRUSION DETECTED</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Identified Violating Tracklets Log */}
      {result?.violating_tracklets && result.violating_tracklets.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800 font-mono text-xs space-y-2">
          <div className="text-slate-400 font-bold uppercase text-[11px] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Verified Spatial Breach Incidents:
          </div>
          {result.violating_tracklets.map((t) => (
            <div
              key={t.track_id}
              className="bg-[#0b0f19] border border-red-500/40 p-3 rounded flex items-center justify-between text-slate-200"
            >
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded font-bold">
                  TARGET #{t.track_id}
                </span>
                <span className="font-bold uppercase text-slate-100">{t.object_class}</span>
                <span className="text-sky-400">@ {t.best_timestamp_sec}s</span>
              </div>
              <div className="text-[11px] text-slate-400 max-w-lg truncate">
                {t.gemini_verification}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
