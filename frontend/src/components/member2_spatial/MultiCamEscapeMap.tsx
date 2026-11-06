"use client";

import React, { useState, useEffect } from "react";
import { Navigation, MapPin, Gauge, Clock, ArrowRight } from "lucide-react";
import { EscapeMapResponse } from "@/types/contract";

export const MultiCamEscapeMap: React.FC = () => {
  const [escapeData, setEscapeData] = useState<EscapeMapResponse>({
    track_id: 101,
    nodes: [
      {
        camera_id: "CAM_01_GATE",
        camera_name: "Perimeter Main Gate (Noida)",
        lat: 28.6280,
        lng: 77.3649,
        timestamp_sec: 43.6,
        crop_url: "/mock_crops/track_101.jpg",
        est_speed_kmh: 42.0,
      },
      {
        camera_id: "CAM_02_HOSTEL_RD",
        camera_name: "Hostel Access Road",
        lat: 28.6255,
        lng: 77.3680,
        timestamp_sec: 197.1,
        crop_url: "/mock_crops/track_103.jpg",
        est_speed_kmh: 48.5,
      },
      {
        camera_id: "CAM_03_NH48",
        camera_name: "NH48 Highway Slip Road",
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
            Multi-Camera Re-ID Escape Vector Map
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Cross-camera suspect trajectory tracking with distance & velocity computation.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="bg-[#0b0f19] px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-500">TOTAL VECTOR: </span>
            <span className="text-emerald-400 font-bold">{escapeData.total_distance_km} KM</span>
          </div>
          <div className="bg-[#0b0f19] px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-500">AVG SPEED: </span>
            <span className="text-sky-400 font-bold">{escapeData.avg_speed_kmh} KM/H</span>
          </div>
        </div>
      </div>

      {/* Visual Vector Progression Diagram */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-5 relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {escapeData.nodes.map((node, index) => (
            <div
              key={node.camera_id}
              className="bg-[#111827] border border-slate-800 hover:border-emerald-500/50 rounded-lg p-4 font-mono transition"
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

              <div className="text-xs font-bold text-slate-200">{node.camera_name}</div>
              
              <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-400" /> TIME:
                  </span>
                  <span className="text-slate-200">
                    {Math.floor(node.timestamp_sec / 60)}:{(node.timestamp_sec % 60).toFixed(0).padStart(2, "0")}s
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-amber-400" /> VELOCITY:
                  </span>
                  <span className="text-amber-400 font-bold">
                    {node.est_speed_kmh ? `${node.est_speed_kmh} km/h` : "Origin"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  LAT: {node.lat.toFixed(4)} | LNG: {node.lng.toFixed(4)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Directional Flow Arrows between cards */}
        <div className="hidden md:flex justify-between items-center absolute inset-x-1/4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
          <ArrowRight className="w-8 h-8 text-emerald-500 animate-pulse" />
          <ArrowRight className="w-8 h-8 text-emerald-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
};
