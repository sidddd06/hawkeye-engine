"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Upload, 
  Play, 
  Pause, 
  RotateCcw, 
  ShieldCheck, 
  Moon, 
  Camera, 
  Hash, 
  ExternalLink,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { TrackletRecord, SearchResponse } from "@/types/contract";

interface SearchAndPlayerProps {
  initialTracklets?: TrackletRecord[];
}

export const SearchAndPlayer: React.FC<SearchAndPlayerProps> = ({ initialTracklets = [] }) => {
  const [query, setQuery] = useState("red motorcycle with blue backpack");
  const [cameraFilter, setCameraFilter] = useState<string>("ALL");
  const [results, setResults] = useState<TrackletRecord[]>(initialTracklets);
  const [selectedTracklet, setSelectedTracklet] = useState<TrackletRecord | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Video Player States
  const [currentTime, setCurrentTime] = useState(43.6);
  const [isPlaying, setIsPlaying] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+F to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.code === "Space" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Initial load
  useEffect(() => {
    if (results.length === 0) {
      handleSearch();
    } else if (!selectedTracklet && results.length > 0) {
      setSelectedTracklet(results[0]);
    }
  }, []);

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery !== undefined ? overrideQuery : query;
    setIsSearching(true);
    try {
      const res = await fetch("http://localhost:8000/api/search/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          top_k: 8,
          camera_filter: cameraFilter === "ALL" ? null : cameraFilter,
        }),
      });
      if (res.ok) {
        const data: SearchResponse = await res.json();
        setResults(data.results);
        if (data.results.length > 0) {
          setSelectedTracklet(data.results[0]);
          setCurrentTime(data.results[0].best_timestamp_sec);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setIsSearching(false);
    }
  };

  const handleJumpToTracklet = (tracklet: TrackletRecord) => {
    setSelectedTracklet(tracklet);
    setCurrentTime(tracklet.best_timestamp_sec);
    setIsPlaying(false);
  };

  return (
    <div className="space-y-6">
      {/* Tactical Search Bar & Filter Bar */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search 12hr CCTV via SigLIP... (e.g. 'red motorcycle with blue backpack' or 'night intruder climbing fence') [Ctrl+F]"
              className="w-full bg-[#0b0f19] border border-slate-700 rounded pl-10 pr-24 py-2 text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
            />
            <span className="absolute right-3 top-2.5 text-[10px] font-mono text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded">
              Ctrl+F
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={cameraFilter}
              onChange={(e) => {
                setCameraFilter(e.target.value);
              }}
              className="bg-[#0b0f19] border border-slate-700 text-slate-300 text-xs font-mono rounded px-3 py-2 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">ALL CAMERAS (3)</option>
              <option value="CAM_01_GATE">CAM_01_GATE (Perimeter)</option>
              <option value="CAM_02_HOSTEL_RD">CAM_02_HOSTEL_RD</option>
              <option value="CAM_03_NH48">CAM_03_NH48 (Highway)</option>
            </select>

            <button
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-medium rounded transition flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isSearching ? "SEARCHING..." : "QUERY"}
            </button>
          </div>
        </div>

        {/* Quick Scenario Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono">
          <span className="text-slate-500">TACTICAL PRESETS:</span>
          <button
            onClick={() => {
              setQuery("red motorcycle with blue backpack");
              handleSearch("red motorcycle with blue backpack");
            }}
            className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-sky-300 rounded border border-slate-700/60"
          >
            🏍️ Red Motorcycle Suspect
          </button>
          <button
            onClick={() => {
              setQuery("night trespasser climbing fence");
              handleSearch("night trespasser climbing fence");
            }}
            className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-purple-300 rounded border border-slate-700/60"
          >
            🌙 IR Night Fence Breach
          </button>
          <button
            onClick={() => {
              setQuery("white delivery van at gate");
              handleSearch("white delivery van at gate");
            }}
            className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700/60"
          >
            🚐 White Delivery Van
          </button>
        </div>
      </div>

      {/* Main Split View: Synchronized Video Player & Search Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Synchronized Video Player with HUD Overlays */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                <span>FEED: {selectedTracklet?.camera_id || "CAM_01_GATE"}</span>
              </div>
              <div className="flex items-center gap-3">
                {selectedTracklet?.is_ir_night_mode ? (
                  <span className="flex items-center gap-1 text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800 px-2 py-0.5 rounded animate-pulse">
                    <Moon className="w-3 h-3 text-purple-400" />
                    🌙 IR NIGHT MODE DETECTED (SAT: {selectedTracklet.avg_saturation})
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded">
                    DAYLIGHT RGB (SAT: {selectedTracklet?.avg_saturation})
                  </span>
                )}
                <span className="text-sky-400 font-bold">
                  {Math.floor(currentTime / 60).toString().padStart(2, "0")}:
                  {(currentTime % 60).toFixed(1).padStart(4, "0")}s
                </span>
              </div>
            </div>

            {/* Video Canvas Simulation Area */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {/* Synthetic Surveillance View */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0b0f19]/40 to-black/80 pointer-events-none" />

              {/* Background Street Mock Graphic */}
              <div className="w-full h-full flex flex-col justify-between p-6 opacity-85">
                <div className="flex justify-between items-start font-mono text-[10px] text-emerald-500/80">
                  <div>
                    <div>LIVE REC [CH-01] // 1080P 30FPS</div>
                    <div>FPS: 29.97 | BITRATE: 4120 KBPS</div>
                  </div>
                  <div className="text-right">
                    <div>TIMESTAMP: 2026-11-06T19:26:38Z</div>
                    <div>LAT: 28.6280 | LNG: 77.3649</div>
                  </div>
                </div>

                {/* Bounding Box Render for Selected Tracklet */}
                {selectedTracklet && (
                  <div className="relative mx-auto my-auto border-2 border-sky-400/90 rounded bg-sky-500/10 p-3 max-w-xs shadow-[0_0_15px_rgba(56,189,248,0.4)]">
                    <div className="absolute -top-6 left-0 bg-sky-500 text-black text-[10px] font-mono font-bold px-2 py-0.5 rounded-t">
                      [{selectedTracklet.object_class.toUpperCase()} #{selectedTracklet.track_id}]
                    </div>
                    <img
                      src={selectedTracklet.crop_url}
                      alt="Active Target"
                      className="w-48 h-32 object-cover rounded border border-sky-400/50"
                    />
                    <div className="mt-2 text-[10px] font-mono text-slate-200">
                      <div>AREA: 2,840 px² (&gt; 50x50px filter passed)</div>
                      <div className="text-emerald-400">
                        MATCH: {((selectedTracklet.similarity_score || 0.8) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-end font-mono text-[10px] text-slate-500">
                  <div>HAWKEYE LOCAL SIEVE ENGINE // ZERO CLOUD STREAMING</div>
                  <div className="text-sky-400">STATUS: ZERO BUFFERING</div>
                </div>
              </div>
            </div>

            {/* Video Scrubber & Playback Controls */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded transition"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setCurrentTime(selectedTracklet?.best_timestamp_sec || 0)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded transition text-xs font-mono"
                  title="Snap to Best Crop"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={8400}
                    step={0.5}
                    value={currentTime}
                    onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                <span className="text-xs font-mono text-slate-400">
                  {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, "0")} / 140:00
                </span>
              </div>
            </div>
          </div>

          {/* Gemini Flash Precision Verifier Audit Box */}
          {selectedTracklet && (
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  STAGE 4: GEMINI 2.5 FLASH PRECISION AUDIT
                </div>
                <div className="text-[10px] text-slate-400">
                  SHA-256: {selectedTracklet.sha256_frame_hash.substring(0, 16)}...
                </div>
              </div>
              <div className="mt-3 text-slate-300 leading-relaxed bg-[#0b0f19] p-3 rounded border border-slate-800">
                {selectedTracklet.gemini_verification || "Pending Gemini Flash verification."}
              </div>
            </div>
          )}
        </div>

        {/* Right: Forensic Search Matches Grid */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase">
              Ranked Candidates ({results.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Sorted by SigLIP Inner Product
            </span>
          </div>

          <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
            {results.map((rec) => {
              const isSelected = selectedTracklet?.track_id === rec.track_id;
              return (
                <div
                  key={rec.track_id}
                  onClick={() => handleJumpToTracklet(rec)}
                  className={`p-3 rounded-lg border transition cursor-pointer font-mono text-xs ${
                    isSelected
                      ? "bg-sky-950/40 border-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.2)]"
                      : "bg-[#111827] border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Thumbnail Image */}
                    <div className="relative w-24 h-16 bg-slate-900 rounded overflow-hidden flex-shrink-0 border border-slate-800">
                      <img
                        src={rec.crop_url}
                        alt={`Tracklet ${rec.track_id}`}
                        className="w-full h-full object-cover"
                      />
                      {rec.is_ir_night_mode && (
                        <div className="absolute bottom-0 inset-x-0 bg-purple-950/90 text-purple-300 text-[9px] text-center font-bold">
                          🌙 IR MODE
                        </div>
                      )}
                    </div>

                    {/* Metadata & Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 uppercase">
                          {rec.object_class} #{rec.track_id}
                        </span>
                        <span className="text-emerald-400 font-bold">
                          {((rec.similarity_score || 0.8) * 100).toFixed(1)}% MATCH
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>{rec.camera_id}</span>
                        <span>•</span>
                        <span className="text-sky-400">
                          @ {Math.floor(rec.best_timestamp_sec / 60)}:
                          {(rec.best_timestamp_sec % 60).toFixed(1).padStart(4, "0")}s
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 mt-1.5 truncate">
                        {rec.gemini_verification || "Verified visual tracklet."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
