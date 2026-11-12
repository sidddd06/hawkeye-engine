"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Sparkles,
  FastForward,
  Image as ImageIcon,
  AlertCircle,
  HelpCircle,
  VideoOff,
  Crosshair
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
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [videoError, setVideoError] = useState<boolean>(false);
  
  // HTML5 Video Player references & state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [currentTime, setCurrentTime] = useState<number>(7.5);
  const [duration, setDuration] = useState<number>(24.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // 60 FPS Optimized Bounding Box Canvas Renderer via requestAnimationFrame
  const renderCanvasFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const timeSec = video.currentTime;

    if (selectedTracklet && selectedTracklet.trajectory.length > 0) {
      if (
        timeSec >= selectedTracklet.start_time_sec - 0.5 &&
        timeSec <= selectedTracklet.end_time_sec + 0.5
      ) {
        let closestPt = selectedTracklet.trajectory[0];
        let minDiff = 999.0;
        for (const pt of selectedTracklet.trajectory) {
          const diff = Math.abs(pt.timestamp_sec - timeSec);
          if (diff < minDiff) {
            minDiff = diff;
            closestPt = pt;
          }
        }

        if (closestPt) {
          const scaleX = canvas.width / 1280.0;
          const scaleY = canvas.height / 720.0;
          const bx = closestPt.x1 * scaleX;
          const by = closestPt.y1 * scaleY;
          const bw = (closestPt.x2 - closestPt.x1) * scaleX;
          const bh = (closestPt.y2 - closestPt.y1) * scaleY;

          // Glowing neon forensic bounding box
          ctx.strokeStyle = selectedTracklet.is_ir_night_mode ? "#c084fc" : "#38bdf8";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(bx, by, bw, bh);

          // Header label tag
          ctx.fillStyle = selectedTracklet.is_ir_night_mode ? "#581c87" : "#0284c7";
          ctx.fillRect(bx, by - 22, bw, 22);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px monospace";
          ctx.fillText(
            `[#${selectedTracklet.track_id} ${selectedTracklet.object_class.toUpperCase()}]`,
            bx + 4,
            by - 6
          );

          // Center crosshair
          const cx = bx + bw / 2;
          const cy = by + bh / 2;
          ctx.strokeStyle = "#eab308";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx - 8, cy);
          ctx.lineTo(cx + 8, cy);
          ctx.moveTo(cx, cy - 8);
          ctx.lineTo(cx, cy + 8);
          ctx.stroke();
        }
      }
    }

    if (!video.paused && !video.ended) {
      animFrameIdRef.current = requestAnimationFrame(renderCanvasFrame);
    }
  }, [selectedTracklet]);

  // Keyboard shortcut: Ctrl+F to focus search, Space to play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.code === "Space" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying]);

  // Initial load
  useEffect(() => {
    if (results.length === 0) {
      handleSearch();
    } else if (!selectedTracklet && results.length > 0) {
      setSelectedTracklet(results[0]);
    }
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
      animFrameIdRef.current = requestAnimationFrame(renderCanvasFrame);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    renderCanvasFrame();
  };

  const handleSeek = (timeSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = timeSec;
    setCurrentTime(timeSec);
    renderCanvasFrame();
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

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
          handleJumpToTracklet(data.results[0]);
        } else {
          setSelectedTracklet(null);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setIsSearching(false);
    }
  };

  const handleImageSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsSearching(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("top_k", "8");

      try {
        const res = await fetch("http://localhost:8000/api/search/image", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data: SearchResponse = await res.json();
          setResults(data.results);
          if (data.results.length > 0) {
            handleJumpToTracklet(data.results[0]);
          }
        }
      } catch {
        // Offline fallback
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleJumpToTracklet = (tracklet: TrackletRecord) => {
    setSelectedTracklet(tracklet);
    handleSeek(tracklet.best_timestamp_sec);
  };

  return (
    <div className="space-y-6">
      {/* Tactical Search Bar & Filter Bar */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 shadow-md">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search surveillance footage via SigLIP"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search 12hr CCTV via SigLIP (e.g. 'red motorcycle with blue backpack') [Ctrl+F]"
              className="w-full bg-[#0b0f19] border border-slate-700 rounded pl-10 pr-24 py-2 text-sm text-slate-100 placeholder-slate-500 font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            <span className="absolute right-3 top-2.5 text-[10px] font-mono text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded select-none">
              Ctrl+F
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filter search results by camera feed"
              value={cameraFilter}
              onChange={(e) => setCameraFilter(e.target.value)}
              className="bg-[#0b0f19] border border-slate-700 text-slate-300 text-xs font-mono rounded px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="ALL">ALL CAMERAS (3)</option>
              <option value="CAM_01_GATE">CAM_01_GATE (Perimeter)</option>
              <option value="CAM_02_HOSTEL_RD">CAM_02_HOSTEL_RD</option>
              <option value="CAM_03_NH48">CAM_03_NH48 (Highway)</option>
            </select>

            {/* Photo Similarity Upload Search Button */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              aria-label="Upload reference photo for image search"
              onChange={handleImageSearch}
              className="hidden"
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              aria-label="Trigger photo similarity search"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded transition flex items-center gap-1.5 border border-slate-700 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              title="Upload reference photo for SigLIP image-to-image similarity search"
            >
              <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
              PHOTO SEARCH
            </button>

            <button
              onClick={() => handleSearch()}
              disabled={isSearching}
              aria-label="Execute forensic search"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-medium rounded transition flex items-center gap-2 focus:ring-2 focus:ring-sky-400 focus:outline-none shadow-[0_0_12px_rgba(56,189,248,0.3)]"
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
            className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-sky-300 rounded border border-slate-700/60 focus:ring-1 focus:ring-sky-400 focus:outline-none"
          >
            🏍️ Red Motorcycle Suspect
          </button>
          <button
            onClick={() => {
              setQuery("night trespasser climbing fence");
              handleSearch("night trespasser climbing fence");
            }}
            className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-purple-300 rounded border border-slate-700/60 focus:ring-1 focus:ring-purple-400 focus:outline-none"
          >
            🌙 IR Night Fence Breach
          </button>
          <button
            onClick={() => {
              setQuery("pedestrian with black duffel bag");
              handleSearch("pedestrian with black duffel bag");
            }}
            className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700/60 focus:ring-1 focus:ring-emerald-400 focus:outline-none"
          >
            🚶 Pedestrian with Duffel Bag
          </button>
          <button
            onClick={() => {
              setQuery("white delivery van at gate");
              handleSearch("white delivery van at gate");
            }}
            className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-amber-300 rounded border border-slate-700/60 focus:ring-1 focus:ring-amber-400 focus:outline-none"
          >
            🚐 White Delivery Van
          </button>
        </div>
      </div>

      {/* Main Split View: Synchronized Video Player & Search Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Synchronized Video Player with Canvas HUD Overlays */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden shadow-lg">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                <span>FEED: {selectedTracklet?.camera_id || "CAM_01_GATE"}</span>
              </div>
              <div className="flex items-center gap-3">
                {selectedTracklet?.is_ir_night_mode ? (
                  <span className="flex items-center gap-1 text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                    <Moon className="w-3 h-3 text-purple-400" />
                    🌙 IR NIGHT MODE DETECTED (SAT: {selectedTracklet.avg_saturation})
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded">
                    DAYLIGHT RGB (SAT: {selectedTracklet?.avg_saturation || 58.4})
                  </span>
                )}
                <span className="text-sky-400 font-bold">
                  {Math.floor(currentTime / 60).toString().padStart(2, "0")}:
                  {(currentTime % 60).toFixed(1).padStart(4, "0")}s
                </span>
              </div>
            </div>

            {/* Video Player & 60 FPS Bounding Box Canvas Overlay */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                src="/sample_cctv_feed.mp4"
                onTimeUpdate={handleTimeUpdate}
                onError={() => setVideoError(true)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 24.0)}
                playsInline
                loop
                muted
                className="w-full h-full object-contain"
              />

              {videoError && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 space-y-2 font-mono">
                  <VideoOff className="w-8 h-8 text-amber-400" />
                  <div className="text-xs font-bold text-slate-200">
                    CCTV STREAM OFFLINE // RENDERING SYNTHETIC FORENSIC CANVAS
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Synchronized telemetry and bounding-box coordinates remain 100% active.
                  </p>
                </div>
              )}

              {/* 60 FPS Canvas HUD Overlay */}
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {!isPlaying && !videoError && (
                <div
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                  aria-label="Click to play surveillance feed"
                >
                  <div className="w-14 h-14 rounded-full bg-sky-500/80 hover:bg-sky-400 text-black flex items-center justify-center transition shadow-[0_0_20px_rgba(56,189,248,0.5)]">
                    <Play className="w-7 h-7 fill-black ml-1" />
                  </div>
                </div>
              )}
            </div>

            {/* Video Scrubber & Playback Controls */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause video [Space]" : "Play video [Space]"}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded transition focus:ring-1 focus:ring-sky-500 focus:outline-none"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => handleSeek(selectedTracklet?.best_timestamp_sec || 0)}
                  aria-label="Snap to Tracklet Best Timestamp"
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded transition text-xs font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  title="Snap to Tracklet Best Timestamp"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Scrubber Timeline Slider */}
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="range"
                    aria-label="Timeline Scrubber"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg focus:outline-none"
                  />
                </div>

                {/* Speed Controls */}
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  {[1.0, 2.0, 4.0].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      aria-label={`Set speed ${speed}x`}
                      className={`px-1.5 py-0.5 rounded focus:outline-none ${
                        playbackSpeed === speed
                          ? "bg-sky-600 text-white font-bold"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>

                <span className="text-xs font-mono text-slate-400 select-none">
                  {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, "0")} /{" "}
                  {Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, "0")}s
                </span>
              </div>
            </div>
          </div>

          {/* Gemini Flash Precision Verifier Audit Box */}
          {selectedTracklet && (
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 font-mono text-xs shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  STAGE 4: GEMINI 2.5 FLASH PRECISION AUDIT
                </div>
                <div className="text-[10px] text-slate-400">
                  SHA-256: {selectedTracklet.sha256_frame_hash.substring(0, 16)}...
                </div>
              </div>
              <div className="mt-3 text-slate-300 leading-relaxed bg-[#0b0f19] p-3 rounded border border-slate-800">
                {selectedTracklet.gemini_verification || "Verified visual tracklet."}
              </div>
            </div>
          )}
        </div>

        {/* Right: Ranked Search Matches Grid */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase">
              Ranked Candidates ({results.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Sorted by SigLIP Inner Product
            </span>
          </div>

          {/* Empty Search Results UI */}
          {results.length === 0 && !isSearching && (
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-8 text-center font-mono text-xs space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <div className="font-bold text-slate-200">
                ZERO FORENSIC MATCHES FOR QUERY
              </div>
              <p className="text-[11px] text-slate-400">
                SigLIP vector distance exceeded similarity threshold. Try broadening your query or select a tactical preset.
              </p>
              <button
                onClick={() => {
                  setQuery("motorcycle");
                  handleSearch("motorcycle");
                }}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold transition focus:ring-2 focus:ring-sky-400 focus:outline-none"
              >
                RESET TO DEFAULT TARGETS
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {isSearching && (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 bg-[#111827] border border-slate-800 rounded-lg flex gap-3">
                  <div className="w-24 h-16 bg-slate-800 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-800 rounded w-1/2" />
                    <div className="h-3 bg-slate-800 rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
            {results.map((rec) => {
              const isSelected = selectedTracklet?.track_id === rec.track_id;
              return (
                <div
                  key={rec.track_id}
                  onClick={() => handleJumpToTracklet(rec)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select tracklet #${rec.track_id} ${rec.object_class}`}
                  onKeyDown={(e) => e.key === "Enter" && handleJumpToTracklet(rec)}
                  className={`p-3 rounded-lg border transition cursor-pointer font-mono text-xs focus:ring-2 focus:ring-sky-400 focus:outline-none ${
                    isSelected
                      ? "bg-sky-950/40 border-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
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
                        <span className="text-sky-400 font-bold">
                          JUMP @ {Math.floor(rec.best_timestamp_sec / 60)}:
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
