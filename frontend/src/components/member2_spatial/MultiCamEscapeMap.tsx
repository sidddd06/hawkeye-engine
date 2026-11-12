"use client";

import React, { useState, useEffect } from "react";
import { 
  Navigation, 
  MapPin, 
  Gauge, 
  Clock, 
  ArrowRight, 
  Compass, 
  Layers,
  Activity,
  AlertCircle
} from "lucide-react";
import { EscapeMapResponse, EscapeVectorNode } from "@/types/contract";

export const MultiCamEscapeMap: React.FC = () => {
  const [selectedTargetId, setSelectedTargetId] = useState<number>(101);
  const [escapeData, setEscapeData] = useState<EscapeMapResponse>({
    track_id: 101,
    nodes: [
      {
        camera_id: "CAM_01_GATE",
        camera_name: "Perimeter Main Gate (Noida Sec 62)",
        lat: 28.6280,
        lng: 77.3649,
        timestamp_sec: 43.6,
        crop_url: "/mock_crops/track_101.jpg",
        est_speed_kmh: 42.0,
      },
      {
        camera_id: "CAM_02_HOSTEL_RD",
        camera_name: "Hostel Access Road Exit",
        lat: 28.6255,
        lng: 77.3680,
        timestamp_sec: 197.1,
        crop_url: "/mock_crops/track_103.jpg",
        est_speed_kmh: 48.5,
      },
      {
        camera_id: "CAM_03_NH48",
        camera_name: "NH48 Highway Merge Slip Road",
        lat: 28.5355,
        lng: 77.3910,
        timestamp_sec: 341.9,
        crop_url: "/mock_crops/track_104.jpg",
        est_speed_kmh: 52.4,
      },
    ],
    total_distance_km: 2.45,
    avg_speed_kmh: 47.6,
  });

  const fetchEscapeMap = async (trackId: number) => {
    setSelectedTargetId(trackId);
    try {
      const res = await fetch(`http://localhost:8000/api/escape-map/${trackId}`);
      if (res.ok) {
        const data: EscapeMapResponse = await res.json();
        setEscapeData(data);
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    fetchEscapeMap(101);
  }, []);

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-400" />
            Multi-Camera Re-ID Escape Vector Map (Leaflet / Geo-Vector)
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Cross-camera suspect trajectory tracking with Haversine distance &amp; velocity computation.
          </p>
        </div>

        {/* Target Switcher & Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1 bg-[#0b0f19] p-1 rounded border border-slate-800">
            <button
              onClick={() => fetchEscapeMap(101)}
              className={`px-3 py-1 rounded transition ${
                selectedTargetId === 101
                  ? "bg-emerald-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🏍️ Track #101 (Red Motorcycle)
            </button>
            <button
              onClick={() => fetchEscapeMap(201)}
              className={`px-3 py-1 rounded transition ${
                selectedTargetId === 201
                  ? "bg-purple-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🌙 Track #201 (Night Intruder)
            </button>
          </div>

          <div className="bg-[#0b0f19] px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-500">VECTOR DISTANCE: </span>
            <span className="text-emerald-400 font-bold">{escapeData.total_distance_km} KM</span>
          </div>
          <div className="bg-[#0b0f19] px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-500">AVG VELOCITY: </span>
            <span className="text-sky-400 font-bold">{escapeData.avg_speed_kmh} KM/H</span>
          </div>
        </div>
      </div>

      {/* Tactical Geographic Map Visualization Canvas */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-5 relative overflow-hidden">
        {/* SVG Tactical Map Layer */}
        <div className="relative aspect-[21/9] max-h-[280px] w-full bg-[#070a12] rounded border border-slate-900 mb-5 overflow-hidden flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 900 300">
            {/* Map Grid Coordinates */}
            <defs>
              <pattern id="grid" width="45" height="45" patternUnits="userSpaceOnUse">
                <path d="M 45 0 L 0 0 0 45" fill="none" stroke="rgba(30, 41, 59, 0.4)" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="900" height="300" fill="url(#grid)" />

            {/* Tactical Compass Rose */}
            <g transform="translate(840, 50)" opacity="0.6">
              <circle cx="0" cy="0" r="28" fill="none" stroke="#334155" strokeWidth="1" />
              <line x1="0" y1="-24" x2="0" y2="24" stroke="#475569" strokeWidth="1.5" />
              <line x1="-24" y1="0" x2="24" y2="0" stroke="#475569" strokeWidth="1.5" />
              <text x="-4" y="-28" fill="#38bdf8" fontSize="10" fontFamily="monospace">N</text>
            </g>

            {/* Connecting Vector Lines */}
            {escapeData.nodes.length >= 2 && (
              <>
                {/* Node 1 to Node 2 */}
                <line
                  x1="180"
                  y1="150"
                  x2="450"
                  y2="180"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray="6,4"
                  className="animate-pulse"
                />
                <circle cx="315" cy="165" r="4" fill="#38bdf8" />
                <text x="270" y="150" fill="#38bdf8" fontSize="10" fontFamily="monospace">
                  48.5 KM/H (0.45 KM)
                </text>
              </>
            )}

            {escapeData.nodes.length >= 3 && (
              <>
                {/* Node 2 to Node 3 */}
                <line
                  x1="450"
                  y1="180"
                  x2="720"
                  y2="120"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray="6,4"
                  className="animate-pulse"
                />
                <circle cx="585" cy="150" r="4" fill="#38bdf8" />
                <text x="540" y="135" fill="#38bdf8" fontSize="10" fontFamily="monospace">
                  52.4 KM/H (2.0 KM)
                </text>
              </>
            )}

            {/* Waypoint Markers */}
            <g transform="translate(180, 150)">
              <circle cx="0" cy="0" r="16" fill="rgba(16, 185, 129, 0.2)" />
              <circle cx="0" cy="0" r="8" fill="#10b981" />
              <text x="-35" y="-14" fill="#10b981" fontSize="11" fontWeight="bold" fontFamily="monospace">
                WP1: GATE (Noida)
              </text>
            </g>

            {escapeData.nodes.length >= 2 && (
              <g transform="translate(450, 180)">
                <circle cx="0" cy="0" r="16" fill="rgba(16, 185, 129, 0.2)" />
                <circle cx="0" cy="0" r="8" fill="#eab308" />
                <text x="-40" y="28" fill="#eab308" fontSize="11" fontWeight="bold" fontFamily="monospace">
                  WP2: HOSTEL ROAD
                </text>
              </g>
            )}

            {escapeData.nodes.length >= 3 && (
              <g transform="translate(720, 120)">
                <circle cx="0" cy="0" r="16" fill="rgba(239, 68, 68, 0.2)" />
                <circle cx="0" cy="0" r="8" fill="#ef4444" />
                <text x="-40" y="-14" fill="#ef4444" fontSize="11" fontWeight="bold" fontFamily="monospace">
                  WP3: NH48 HIGHWAY
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Waypoint Chronological Progression Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 font-mono">
          {escapeData.nodes.map((node, index) => (
            <div
              key={node.camera_id}
              className="bg-[#111827] border border-slate-800 hover:border-emerald-500/60 rounded-lg p-4 transition shadow-lg"
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  WAYPOINT #{index + 1}
                </span>
                <span className="text-slate-500 text-[10px]">{node.camera_id}</span>
              </div>

              <div className="aspect-video bg-slate-900 rounded overflow-hidden mb-3 border border-slate-800">
                <img
                  src={node.crop_url}
                  alt={node.camera_name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="text-xs font-bold text-slate-100">{node.camera_name}</div>
              
              <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-3 h-3 text-sky-400" /> SIGHTING:
                  </span>
                  <span className="text-slate-200 font-bold">
                    {Math.floor(node.timestamp_sec / 60)}:{(node.timestamp_sec % 60).toFixed(0).padStart(2, "0")}s
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-500">
                    <Gauge className="w-3 h-3 text-amber-400" /> VELOCITY:
                  </span>
                  <span className="text-amber-400 font-bold">
                    {node.est_speed_kmh ? `${node.est_speed_kmh} km/h` : "Origin"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  COORDS: {node.lat.toFixed(4)}° N, {node.lng.toFixed(4)}° E
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
