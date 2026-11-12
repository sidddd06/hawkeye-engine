"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Cpu,
  Search,
  MapPin,
  Film,
  HardDrive,
  Shield,
  Activity,
  Upload,
  RefreshCw,
  Keyboard,
  Loader2,
} from "lucide-react";

import { IngestionTelemetry } from "@/components/member1_core/IngestionTelemetry";
import { SearchAndPlayer } from "@/components/member1_core/SearchAndPlayer";
import { PolygonTripwire } from "@/components/member2_spatial/PolygonTripwire";
import { MultiCamEscalation } from "@/components/member2_spatial/MultiCamEscalation";
import { ForensicSynopsisDossier } from "@/components/member2_spatial/ForensicSynopsisDossier";
import { HealthResponse, SearchResponse, TrackletRecord } from "@/types/contract";

/* ============================================================================
 * Types & helpers
 * ========================================================================== */
type TabId = "ingest" | "search" | "spatial" | "synopsis";

const API_BASE = "http://localhost:8000";

interface VideoSource {
  name: string;
  size: string;
  duration?: string;
  resolution?: string;
  durationSec?: number;
  width?: number;
  height?: number;
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDuration = (sec: number) => {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${r.toFixed(0).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${r.toFixed(1).padStart(4, "0")}`;
};

/** Reads the real duration and resolution straight from the playable file in the browser. */
function probeVideo(url: string, timeoutMs = 8000): Promise<{ durationSec: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (r: { durationSec: number; width: number; height: number } | null) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      v.removeAttribute("src");
      v.load();
      resolve(r);
    };
    timer = setTimeout(() => finish(null), timeoutMs);
    v.onloadedmetadata = () =>
      finish({
        durationSec: Number.isFinite(v.duration) ? v.duration : 0,
        width: v.videoWidth,
        height: v.videoHeight,
      });
    v.onerror = () => finish(null);
    v.src = url;
  });
}

const TAB_META: { id: TabId; label: string; Icon: React.ElementType; accent: string; line: string }[] = [
  { id: "ingest", label: "INGEST & SIEVE", Icon: HardDrive, accent: "text-cyan-300", line: "border-cyan-400" },
  { id: "search", label: "SEARCH & PLAYER", Icon: Search, accent: "text-cyan-300", line: "border-cyan-400" },
  { id: "spatial", label: "TRIPWIRE & MULTI-CAM", Icon: MapPin, accent: "text-emerald-300", line: "border-emerald-400" },
  { id: "synopsis", label: "SYNOPSIS & DOSSIER", Icon: Film, accent: "text-amber-300", line: "border-amber-400" },
];

/* ============================================================================
 * Gate shown instead of mock data when no live tracklets exist
 * ========================================================================== */
const LiveDataGate: React.FC<{
  title: string;
  isSyncing: boolean;
  onSync: () => void;
  onIngest: () => void;
}> = ({ title, isSyncing, onSync, onIngest }) => (
  <div className="mx-auto mt-6 max-w-xl rounded-sm border border-slate-800 bg-[#080C12] p-6 text-center font-mono">
    <div className="mb-1 text-[9px] uppercase tracking-[0.2em] text-slate-500">{title}</div>
    <div className="text-sm font-bold text-slate-100">No live tracklets for the active video</div>
    <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-slate-400">
      This view reads tracks, cameras and timings from the indexed video. Ingest footage in tab 01, or sync tracklets already held by the backend.
    </p>
    <div className="mt-4 flex items-center justify-center gap-2">
      <button
        onClick={onIngest}
        className="rounded-sm border border-cyan-400 bg-cyan-500 px-3 py-1.5 text-[11px] font-bold text-[#021018] transition hover:bg-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-300"
      >
        GO TO INGEST
      </button>
      <button
        onClick={onSync}
        disabled={isSyncing}
        className="flex items-center gap-1.5 rounded-sm border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-200 transition hover:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-60"
      >
        {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        SYNC BACKEND INDEX
      </button>
    </div>
  </div>
);

/* ============================================================================
 * Page
 * ========================================================================== */
export default function ForensicCommandCenter() {
  const [activeTab, setActiveTab] = useState<TabId>("search");
  const [spatialSubView, setSpatialSubView] = useState<"tripwire" | "multicam">("tripwire");
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>("/sample_cctv_feed.mp4");
  const [activeVideoFile, setActiveVideoFile] = useState<VideoSource | null>(null);
  const [realTracklets, setRealTracklets] = useState<TrackletRecord[] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const latestUrlRef = useRef(activeVideoUrl);
  const hydratedRef = useRef(false);
  const ingestRootRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latestUrlRef.current = activeVideoUrl;
  }, [activeVideoUrl]);

  const notify = useCallback((msg: string) => {
    setStatusNotification(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setStatusNotification(null), 4000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  /* ---- backend health ---- */
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data: HealthResponse = await res.json();
        setHealth(data);
        setIsBackendOnline(true);
      } else {
        setIsBackendOnline(false);
      }
    } catch {
      setIsBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  /* ---- pull the backend's indexed tracklets (real records only, nothing synthesized) ---- */
  const syncIndex = useCallback(
    async (silent = false) => {
      setIsSyncing(true);
      try {
        const res = await fetch(`${API_BASE}/api/search/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "", top_k: 60, camera_filter: null }),
        });
        if (res.ok) {
          const data: SearchResponse = await res.json();
          if (data.results && data.results.length > 0) {
            setRealTracklets(data.results);
            if (!silent) notify(`✓ ${data.results.length} INDEXED TRACKLETS SYNCED`);
          } else if (!silent) {
            notify("BACKEND INDEX IS EMPTY // INGEST FOOTAGE FIRST");
          }
        } else if (!silent) {
          notify(`INDEX SYNC FAILED // HTTP ${res.status}`);
        }
      } catch {
        if (!silent) notify("BACKEND UNREACHABLE // CLIENT AIR-GAPPED");
      } finally {
        setIsSyncing(false);
      }
    },
    [notify]
  );

  // First time the backend reports indexed tracklets and nothing is loaded locally, adopt them.
  useEffect(() => {
    if (
      !hydratedRef.current &&
      isBackendOnline &&
      health &&
      health.loaded_tracklets_count > 0 &&
      !realTracklets
    ) {
      hydratedRef.current = true;
      void syncIndex(true);
    }
  }, [health, isBackendOnline, realTracklets, syncIndex]);

  /* ---- a new video replaces the old state completely (no stale tracklets) ---- */
  const ingestVideo = useCallback(
    async (
      videoUrl: string,
      file: File,
      tracklets?: TrackletRecord[] | null,
      meta?: { size?: string; resolution?: string; duration?: string } | null
    ) => {
      hydratedRef.current = true;
      setActiveVideoUrl(videoUrl);
      setRealTracklets(tracklets && tracklets.length > 0 ? tracklets : null);
      setActiveVideoFile({
        name: file.name,
        size: meta?.size || formatBytes(file.size),
        resolution: meta?.resolution,
        duration: meta?.duration,
      });
      notify(`✓ FOOTAGE LOADED: ${file.name.toUpperCase()} // ACTIVE FEED`);
      setActiveTab("search");

      // Replace any metadata guess with what the browser actually decodes.
      const probe = await probeVideo(videoUrl);
      if (probe && latestUrlRef.current === videoUrl) {
        setActiveVideoFile((prev) =>
          prev
            ? {
                ...prev,
                resolution: probe.width && probe.height ? `${probe.width}x${probe.height}` : prev.resolution,
                duration: probe.durationSec > 0 ? formatDuration(probe.durationSec) : prev.duration,
                durationSec: probe.durationSec > 0 ? probe.durationSec : undefined,
                width: probe.width || undefined,
                height: probe.height || undefined,
              }
            : prev
        );
      }
    },
    [notify]
  );

  /* ---- live telemetry derived only from real tracklets + the real file ---- */
  const telemetry = useMemo(() => {
    const list = realTracklets ?? [];
    const classes: Record<string, number> = {};
    const cams = new Set<string>();
    let simSum = 0;
    let simN = 0;
    list.forEach((t) => {
      const c = t.object_class || "object";
      classes[c] = (classes[c] || 0) + 1;
      if (t.camera_id) cams.add(t.camera_id);
      if (typeof t.similarity_score === "number") {
        simSum += t.similarity_score;
        simN += 1;
      }
    });

    const dur = activeVideoFile?.durationSec ?? 0;
    let coverage: number | null = null;
    if (dur > 0 && list.length > 0) {
      const iv = list
        .map((t) => [Math.max(0, t.start_time_sec), Math.min(dur, t.end_time_sec)] as [number, number])
        .filter(([a, b]) => b > a)
        .sort((a, b) => a[0] - b[0]);
      let covered = 0;
      let curS = -1;
      let curE = -1;
      iv.forEach(([a, b]) => {
        if (curE < 0) {
          curS = a;
          curE = b;
        } else if (a <= curE) {
          curE = Math.max(curE, b);
        } else {
          covered += curE - curS;
          curS = a;
          curE = b;
        }
      });
      if (curE >= 0) covered += curE - curS;
      coverage = Math.min(1, covered / dur);
    }

    const classLine = Object.entries(classes)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}×${v}`)
      .join(" ");

    return {
      count: list.length,
      classLine: classLine || "—",
      cams: cams.size,
      coverage,
      avgSim: simN > 0 ? simSum / simN : null,
    };
  }, [realTracklets, activeVideoFile?.durationSec]);

  const hasTracklets = (realTracklets?.length ?? 0) > 0;

  /* ---- "Upload New Video": jump to the ingest tab and open its file picker ---- */
  const requestUpload = useCallback(() => {
    setActiveTab("ingest");
    window.setTimeout(() => {
      const input = ingestRootRef.current?.querySelector<HTMLInputElement>('input[type="file"]');
      input?.click();
    }, 80);
  }, []);

  /* ======================================================================
   * Render
   * ==================================================================== */
  const apiLabel = isBackendOnline === null ? "API: CONNECTING" : isBackendOnline ? "API: ONLINE" : "CLIENT AIR-GAPPED";
  const apiTone =
    isBackendOnline === null
      ? "text-slate-400"
      : isBackendOnline
      ? "text-emerald-400"
      : "text-amber-400";
  const apiDot =
    isBackendOnline === null ? "bg-slate-500" : isBackendOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400";

  return (
    <div className="flex min-h-screen flex-col bg-[#05070B] font-mono text-slate-200 selection:bg-cyan-500 selection:text-black">
      {/* ================= HEADER ================= */}
      <header role="banner" className="sticky top-0 z-50 border-b border-slate-800 bg-[#05070B]/95 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-[1920px] items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-7 w-7 select-none items-center justify-center rounded-sm border border-cyan-400/70 bg-cyan-500/10 text-sm shadow-[0_0_12px_rgba(34,211,238,0.25)]"
            >
              🦅
            </div>
            <h1 className="truncate text-[13px] font-bold uppercase tracking-[0.14em] text-slate-100">HAWKEYE // BOUNTYCAM</h1>
            <span className="hidden rounded-sm border border-cyan-900 bg-cyan-950/50 px-1.5 py-px text-[9px] tracking-wider text-cyan-400 md:inline">
              ZERO-CLOUD FORENSICS
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            <div
              aria-label={`Backend status: ${apiLabel}`}
              className="flex items-center gap-1.5 rounded-sm border border-slate-800 bg-[#080C12] px-2 py-1"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${apiDot}`} />
              <span className={`font-bold ${apiTone}`}>{apiLabel}</span>
            </div>
            <div
              aria-label={`GPU accelerator: ${health?.gpu_device_name ?? "not reported"}`}
              className="hidden items-center gap-1.5 rounded-sm border border-slate-800 bg-[#080C12] px-2 py-1 sm:flex"
            >
              <Cpu className="h-3 w-3 text-cyan-400" />
              <span className="text-slate-500">GPU</span>
              <span className="font-bold text-cyan-300">{health?.gpu_device_name ?? "—"}</span>
            </div>
            <div
              aria-label="Stage 4 Gemini 2.5 Flash verifier"
              className="hidden items-center gap-1.5 rounded-sm border border-slate-800 bg-[#080C12] px-2 py-1 text-emerald-400 lg:flex"
            >
              <Shield className="h-3 w-3" />
              <span className="font-bold">GEMINI 2.5 FLASH</span>
            </div>
          </div>
        </div>
      </header>

      {/* ================= NAV ================= */}
      <nav role="tablist" aria-label="Forensic Command Center sections" className="border-b border-slate-800 bg-[#070A10]">
        <div className="mx-auto flex max-w-[1920px] items-center overflow-x-auto px-4">
          {TAB_META.map(({ id, label, Icon, accent, line }, i) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-[11px] font-bold tracking-wider transition focus:outline-none focus-visible:bg-slate-900 ${
                  active ? `${line} ${accent} bg-white/[0.03]` : "border-transparent text-slate-500 hover:text-slate-200"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? accent : "text-slate-600"}`} />
                <span className="tabular-nums text-slate-600">{String(i + 1).padStart(2, "0")}</span>
                {label}
                {id === "search" && hasTracklets && (
                  <span className="rounded-sm border border-cyan-900 bg-cyan-950/60 px-1 text-[9px] text-cyan-300">{telemetry.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ================= ACTIVE VIDEO SOURCE COMMAND BAR ================= */}
      <section aria-label="Active video source" className="border-b border-slate-800 bg-[#080C12]">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${activeVideoFile ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-slate-600"}`} />
            <div className="min-w-0">
              <div className="text-[8px] uppercase tracking-[0.2em] text-slate-500">Active video source</div>
              <div className="max-w-[360px] truncate text-[12px] font-bold text-cyan-300" title={activeVideoFile?.name}>
                {activeVideoFile ? activeVideoFile.name : "No footage uploaded"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-4 border-l border-slate-800 pl-4 text-[11px] sm:grid-cols-4 lg:grid-cols-7">
            <div>
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Size</div>
              <div className="tabular-nums text-slate-200">{activeVideoFile?.size ?? "—"}</div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Resolution</div>
              <div className="tabular-nums text-slate-200">{activeVideoFile?.resolution ?? "—"}</div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Duration</div>
              <div className="tabular-nums text-slate-200">{activeVideoFile?.duration ?? "—"}</div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Tracklets</div>
              <div className="font-bold tabular-nums text-emerald-300">{telemetry.count}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Classes</div>
              <div className="max-w-[170px] truncate text-slate-200" title={telemetry.classLine}>
                {telemetry.classLine}
              </div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Timeline coverage</div>
              <div className="tabular-nums text-violet-300">
                {telemetry.coverage !== null ? `${(telemetry.coverage * 100).toFixed(0)}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">Cameras</div>
              <div className="tabular-nums text-slate-200">{telemetry.cams || "—"}</div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => void syncIndex(false)}
              disabled={isSyncing}
              title="Pull indexed tracklets from the backend"
              aria-label="Sync backend index"
              className="flex h-8 items-center gap-1.5 rounded-sm border border-slate-700 bg-slate-900/70 px-2.5 text-[11px] font-bold text-slate-300 transition hover:border-cyan-400 hover:text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-60"
            >
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              SYNC
            </button>
            <button
              onClick={requestUpload}
              className="flex h-8 items-center gap-1.5 rounded-sm border border-cyan-400 bg-cyan-500 px-3 text-[11px] font-bold tracking-wider text-[#021018] transition hover:bg-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-300"
            >
              <Upload className="h-3.5 w-3.5" />
              UPLOAD NEW VIDEO
            </button>
          </div>
        </div>
      </section>

      {/* ================= TOAST ================= */}
      {statusNotification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-14 z-[60] flex items-center gap-2 rounded-sm border border-cyan-400 bg-[#05070B]/95 px-3 py-2 text-[11px] font-bold text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.25)]"
        >
          <Activity className="h-3.5 w-3.5 text-cyan-400" />
          {statusNotification}
        </div>
      )}

      {/* ================= MAIN ================= */}
      <main className="mx-auto w-full max-w-[1920px] flex-1 px-4 py-3">
        {/* TAB 1 */}
        {activeTab === "ingest" && (
          <div ref={ingestRootRef}>
            <IngestionTelemetry
              activeVideoFile={activeVideoFile}
              onVideoUploaded={(videoUrl, file, tracklets, meta) => {
                void ingestVideo(videoUrl, file, tracklets, meta);
              }}
            />
          </div>
        )}

        {/* TAB 2 */}
        {activeTab === "search" && (
          <SearchAndPlayer
            activeVideoUrl={activeVideoUrl}
            activeTracklets={realTracklets}
            videoFile={activeVideoFile}
          />
        )}

        {/* TAB 3 */}
        {activeTab === "spatial" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-emerald-500/25 bg-[#080C12] px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="uppercase tracking-wider text-emerald-400">Spatial module</span>
                <span className="text-[10px] font-normal text-slate-400">
                  {spatialSubView === "tripwire" ? "Ray-casting polygon intrusion" : "Floorplan homography and handoff"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  onClick={() => setSpatialSubView("tripwire")}
                  className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-bold transition focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                    spatialSubView === "tripwire"
                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
                      : "border-slate-800 bg-[#05070B] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  POLYGON TRIPWIRE
                </button>
                <button
                  onClick={() => setSpatialSubView("multicam")}
                  className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-bold transition focus:outline-none focus:ring-1 focus:ring-violet-400 ${
                    spatialSubView === "multicam"
                      ? "border-violet-400 bg-violet-500/15 text-violet-200"
                      : "border-slate-800 bg-[#05070B] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5 text-violet-400" />
                  MULTI-CAM ESCALATION
                </button>
              </div>
            </div>

            {hasTracklets ? (
              spatialSubView === "tripwire" ? (
                <PolygonTripwire tracklets={realTracklets} videoUrl={activeVideoUrl} />
              ) : (
                <MultiCamEscalation tracklets={realTracklets} videoUrl={activeVideoUrl} />
              )
            ) : (
              <LiveDataGate
                title={spatialSubView === "tripwire" ? "Polygon tripwire" : "Multi-camera escalation"}
                isSyncing={isSyncing}
                onSync={() => void syncIndex(false)}
                onIngest={() => setActiveTab("ingest")}
              />
            )}
          </div>
        )}

        {/* TAB 4 */}
        {activeTab === "synopsis" &&
          (hasTracklets ? (
            <ForensicSynopsisDossier tracklets={realTracklets} videoUrl={activeVideoUrl} />
          ) : (
            <LiveDataGate
              title="Video synopsis and dossier"
              isSyncing={isSyncing}
              onSync={() => void syncIndex(false)}
              onIngest={() => setActiveTab("ingest")}
            />
          ))}
      </main>

      {/* ================= FOOTER ================= */}
      <footer role="contentinfo" className="border-t border-slate-900 bg-[#05070B] px-4 py-2 text-[10px] text-slate-500">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span>HAWKEYE (BOUNTYCAM) // AIR-GAPPED FORENSICS</span>
            <span className="hidden items-center gap-1 text-slate-600 sm:flex">
              <Keyboard className="h-3 w-3" />
              [Space] Play/Pause · [Ctrl+F] Search
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-cyan-500">STAGES 1–3: LOCAL{health?.gpu_device_name ? ` · ${health.gpu_device_name}` : ""}</span>
            <span className="text-slate-700">|</span>
            <span className="text-emerald-500">STAGE 4: GEMINI 2.5 FLASH</span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">SHA-256 CERTIFIED</span>
          </div>
        </div>
      </footer>
    </div>
  );
}