"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  ShieldCheck,
  Moon,
  Camera,
  Sparkles,
  Image as ImageIcon,
  AlertCircle,
  VideoOff,
  Loader2,
  Crosshair,
  X,
  Layers,
} from "lucide-react";
import { TrackletRecord, SearchResponse } from "@/types/contract";

/* ============================================================================
 * Props (unchanged contract with page.tsx)
 * ========================================================================== */
interface SearchAndPlayerProps {
  initialTracklets?: TrackletRecord[];
  activeVideoUrl?: string;
  activeTracklets?: TrackletRecord[] | null;
  isDemoMode?: boolean;
  videoFile?: { name: string; size: string; duration?: string; resolution?: string } | null;
}

/* ============================================================================
 * Constants & local types
 * ========================================================================== */
const API_BASE = "http://localhost:8000";
const EMPTY_TRACKLETS: TrackletRecord[] = [];

const OBJECT_EMOJIS: Record<string, string> = {
  person: "👤",
  motorcycle: "🏍️",
  car: "🚗",
  bicycle: "🚲",
  backpack: "🎒",
  handbag: "👜",
  suitcase: "🧳",
  bus: "🚌",
  truck: "🚛",
};

interface TrajPt {
  timestamp_sec: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A tracklet plus the local ranking annotations produced by the search layer. */
type RankedTracklet = TrackletRecord & {
  _score?: number; // 0..1 relevance inside the current result set
  _reasons?: string[];
  _motion?: number; // 0..1 relative motion index inside the set
  _dwell?: number; // 0..1 stationary ratio
};

interface CoordSpace {
  normalized: boolean; // true when boxes are 0..1
  srcW: number; // pixel-space source frame size (ignored when normalized)
  srcH: number;
}

interface SearchMeta {
  mode: string;
  note: string | null;
  total: number;
  exact: number;
  intents: string[];
}

const PRESETS: { label: string; query: string; tone: string }[] = [
  { label: "ALL DETECTIONS", query: "", tone: "text-slate-300 border-slate-700 hover:border-slate-500" },
  { label: "PERSONS", query: "person", tone: "text-cyan-300 border-cyan-900 hover:border-cyan-500" },
  { label: "THEFT / SHOPLIFTING", query: "theft", tone: "text-rose-300 border-rose-900 hover:border-rose-500" },
  { label: "SUSPICIOUS BEHAVIOR", query: "suspicious", tone: "text-amber-300 border-amber-900 hover:border-amber-500" },
  { label: "HIGH MOTION", query: "fast running motion", tone: "text-violet-300 border-violet-900 hover:border-violet-500" },
  { label: "AISLE ACTIVITY", query: "aisle shopper", tone: "text-emerald-300 border-emerald-900 hover:border-emerald-500" },
  { label: "VEHICLES", query: "vehicle car motorcycle truck", tone: "text-orange-300 border-orange-900 hover:border-orange-500" },
  { label: "BAGS / OBJECTS", query: "bag backpack luggage", tone: "text-sky-300 border-sky-900 hover:border-sky-500" },
];

/* ============================================================================
 * Small helpers
 * ========================================================================== */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const keyOf = (rec: TrackletRecord) => `${rec.camera_id}#${rec.track_id}`;
const domIdOf = (rec: TrackletRecord) => `trk-${keyOf(rec).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

const simOf = (rec: TrackletRecord): number | undefined =>
  typeof rec.similarity_score === "number" ? rec.similarity_score : undefined;

const fmtClock = (sec: number) => {
  const s = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

const fmtJump = (sec: number) => {
  const s = Math.max(0, Number.isFinite(sec) ? sec : 0);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}s`;
};

const trajOf = (() => {
  const cache = new WeakMap<object, TrajPt[]>();
  return (rec: TrackletRecord): TrajPt[] => {
    const hit = cache.get(rec);
    if (hit) return hit;
    const raw = ((rec.trajectory as unknown as TrajPt[] | undefined) ?? []).filter(
      (p) =>
        p &&
        Number.isFinite(p.timestamp_sec) &&
        Number.isFinite(p.x1) &&
        Number.isFinite(p.y1) &&
        Number.isFinite(p.x2) &&
        Number.isFinite(p.y2)
    );
    const sorted = [...raw].sort((a, b) => a.timestamp_sec - b.timestamp_sec);
    cache.set(rec, sorted);
    return sorted;
  };
})();

/* ============================================================================
 * Coordinate-space handling (normalized 0..1 OR pixel space)
 * ========================================================================== */
const STANDARD_SOURCES: [number, number][] = [
  [320, 180],
  [640, 360],
  [768, 432],
  [854, 480],
  [1280, 720],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
];

function inferSourceSpace(recs: TrackletRecord[], vw: number, vh: number): CoordSpace {
  let maxX = 0;
  let maxY = 0;
  let any = false;
  for (const rec of recs) {
    for (const p of trajOf(rec)) {
      any = true;
      maxX = Math.max(maxX, p.x1, p.x2);
      maxY = Math.max(maxY, p.y1, p.y2);
    }
  }
  if (!any) return { normalized: false, srcW: vw, srcH: vh };
  if (Math.max(maxX, maxY) <= 1.5) return { normalized: true, srcW: 1, srcH: 1 };
  // Pixel space that fits inside the native video frame -> trust native pixels.
  if (maxX <= vw * 1.02 && maxY <= vh * 1.02) return { normalized: false, srcW: vw, srcH: vh };
  // Boxes exceed the native frame: they were produced in a larger frame. Find the smallest
  // standard frame (with a compatible aspect ratio) that contains them.
  const aspect = vw / vh;
  for (const [w, h] of STANDARD_SOURCES) {
    if (w >= maxX * 0.98 && h >= maxY * 0.98 && Math.abs(w / h - aspect) < 0.2) {
      return { normalized: false, srcW: w, srcH: h };
    }
  }
  return { normalized: false, srcW: Math.max(maxX, 1), srcH: Math.max(maxY, 1) };
}

function toVideoBox(p: Box, space: CoordSpace, vw: number, vh: number): Box {
  const sx = space.normalized ? vw : vw / (space.srcW || vw);
  const sy = space.normalized ? vh : vh / (space.srcH || vh);
  const xa = p.x1 * sx;
  const xb = p.x2 * sx;
  const ya = p.y1 * sy;
  const yb = p.y2 * sy;
  return { x1: Math.min(xa, xb), y1: Math.min(ya, yb), x2: Math.max(xa, xb), y2: Math.max(ya, yb) };
}

/** Linear interpolation of a tracklet's box at time t. Returns null when t is outside the track. */
function sampleTrack(rec: TrackletRecord, t: number, tol: number): Box | null {
  const tr = trajOf(rec);
  const n = tr.length;
  if (n === 0) return null;
  const first = tr[0];
  const last = tr[n - 1];
  if (t < first.timestamp_sec - tol || t > last.timestamp_sec + tol) return null;
  if (t <= first.timestamp_sec) return first;
  if (t >= last.timestamp_sec) return last;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tr[mid].timestamp_sec <= t) lo = mid;
    else hi = mid;
  }
  const a = tr[lo];
  const b = tr[hi];
  const span = b.timestamp_sec - a.timestamp_sec;
  const f = span > 1e-6 ? (t - a.timestamp_sec) / span : 0;
  return {
    x1: a.x1 + (b.x1 - a.x1) * f,
    y1: a.y1 + (b.y1 - a.y1) * f,
    x2: a.x2 + (b.x2 - a.x2) * f,
    y2: a.y2 + (b.y2 - a.y2) * f,
  };
}

/* ============================================================================
 * Canvas drawing primitives
 * ========================================================================== */
function drawBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  len: number,
  color: string,
  lw: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);
  ctx.moveTo(x, y + h - len);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + len, y + h);
  ctx.moveTo(x + w - len, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - len);
  ctx.stroke();
}

function drawTag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fs: number,
  fg: string,
  bg: string
) {
  ctx.font = `700 ${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const padX = fs * 0.55;
  const tw = ctx.measureText(text).width + padX * 2;
  const th = fs * 1.6;
  let ty = y - th;
  if (ty < 0) ty = y;
  const tx = clamp(x, 0, Math.max(0, ctx.canvas.width - tw));
  ctx.fillStyle = bg;
  ctx.fillRect(tx, ty, tw, th);
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, tx + padX, ty + th / 2);
  ctx.textBaseline = "alphabetic";
}

/* ============================================================================
 * Semantic search layer (local ranking over the uploaded video's tracklets)
 * ========================================================================== */
const STOPWORDS = new Set([
  "a", "an", "the", "in", "on", "of", "at", "with", "and", "or", "to", "for", "is", "are", "was", "who",
  "that", "from", "by", "near", "any", "all", "show", "find", "me", "my", "it", "this", "there",
]);

const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);

const CLASS_SYNONYMS: Record<string, string[]> = {
  person: ["person", "people", "human", "man", "men", "woman", "women", "shopper", "customer", "pedestrian", "suspect", "individual", "guy", "lady", "child", "kid", "clerk", "worker", "walker"],
  car: ["car", "vehicle", "sedan", "suv", "van", "auto", "automobile", "taxi"],
  truck: ["truck", "lorry", "vehicle", "pickup"],
  bus: ["bus", "vehicle", "coach"],
  motorcycle: ["motorcycle", "motorbike", "bike", "scooter", "rider", "vehicle"],
  bicycle: ["bicycle", "bike", "cycle", "cyclist"],
  backpack: ["backpack", "bag", "rucksack", "luggage", "pack"],
  handbag: ["handbag", "bag", "purse"],
  suitcase: ["suitcase", "bag", "luggage"],
};

interface Intent {
  id: string;
  label: string;
  triggerSet: Set<string>;
  classBias: Record<string, number>;
  hintSet: Set<string>;
  w: { motion: number; dwell: number; dur: number };
}

const makeIntent = (
  id: string,
  label: string,
  triggers: string[],
  classBias: Record<string, number>,
  hints: string[],
  w: { motion: number; dwell: number; dur: number }
): Intent => ({
  id,
  label,
  triggerSet: new Set(triggers.map((t) => stem(t))),
  classBias,
  hintSet: new Set(hints.map((t) => stem(t))),
  w,
});

const INTENTS: Intent[] = [
  makeIntent(
    "theft",
    "THEFT",
    ["theft", "thief", "steal", "stealing", "stole", "stolen", "robbery", "robber", "rob", "robbing", "shoplift", "shoplifting", "shoplifter", "burglary", "burglar", "snatch", "loot", "pickpocket", "larceny", "grab"],
    { person: 1, backpack: 0.6, handbag: 0.6, suitcase: 0.6 },
    ["bag", "conceal", "pocket", "grab", "reach", "take", "took", "hide", "hid", "item", "merchandise", "shelf", "pick", "stuff", "carry", "product", "leave", "exit"],
    { motion: 0.35, dwell: 0.35, dur: 0.3 }
  ),
  makeIntent(
    "suspicious",
    "SUSPICIOUS",
    ["suspicious", "suspect", "loiter", "loitering", "lurk", "lurking", "trespass", "trespasser", "intruder", "intrusion", "breach", "unusual", "anomaly", "anomalous", "abnormal", "threat", "casing", "prowl"],
    { person: 1 },
    ["loiter", "wait", "linger", "stand", "watch", "hover", "pace", "behavior", "nervous", "look", "around"],
    { motion: 0.2, dwell: 0.5, dur: 0.3 }
  ),
  makeIntent(
    "motion",
    "HIGH MOTION",
    ["fast", "running", "run", "sprint", "flee", "fleeing", "chase", "speed", "speeding", "rush", "motion", "moving", "move", "quick", "rapid"],
    {},
    ["run", "fast", "speed", "motion", "move", "rapid", "sprint"],
    { motion: 0.8, dwell: 0, dur: 0.2 }
  ),
  makeIntent(
    "scene",
    "SCENE / AISLE",
    ["aisle", "shelf", "shelves", "store", "shop", "retail", "counter", "checkout", "cashier", "interior", "inside", "room", "hallway", "corridor"],
    { person: 0.5 },
    ["aisle", "shelf", "shelves", "store", "shop", "counter", "checkout", "cashier", "product", "merchandise", "inside", "interior"],
    { motion: 0.2, dwell: 0.4, dur: 0.4 }
  ),
];

const SKIP_KEY = /(url|hash|trajectory|thumb|crop|path|uri|base64|image|id)$/i;

function collectText(v: unknown, depth = 0, out: string[] = []): string[] {
  if (depth > 2) return out;
  if (typeof v === "string") {
    if (v.length <= 800) out.push(v);
  } else if (Array.isArray(v)) {
    v.slice(0, 20).forEach((x) => collectText(x, depth + 1, out));
  } else if (v && typeof v === "object") {
    Object.entries(v as Record<string, unknown>).forEach(([k, x]) => {
      if (!SKIP_KEY.test(k)) collectText(x, depth + 1, out);
    });
  }
  return out;
}

interface TextIndex {
  cls: Set<string>;
  gem: Set<string>;
  gemText: string;
  oth: Set<string>;
  othText: string;
}

const indexOf = (() => {
  const cache = new WeakMap<object, TextIndex>();
  return (rec: TrackletRecord): TextIndex => {
    const hit = cache.get(rec);
    if (hit) return hit;
    const cls = (rec.object_class || "object").toLowerCase();
    const clsSet = new Set<string>([stem(cls), ...(CLASS_SYNONYMS[cls] ?? []).map(stem)]);
    const gemText = (rec.gemini_verification || "").toLowerCase();
    const otherParts: string[] = [String(rec.camera_id || "")];
    Object.entries(rec as unknown as Record<string, unknown>).forEach(([k, v]) => {
      if (k === "gemini_verification" || k === "object_class" || k === "trajectory" || SKIP_KEY.test(k)) return;
      collectText(v, 0, otherParts);
    });
    const othText = otherParts.join(" ").toLowerCase();
    const out: TextIndex = {
      cls: clsSet,
      gem: new Set(tokenize(gemText)),
      gemText,
      oth: new Set(tokenize(othText)),
      othText,
    };
    cache.set(rec, out);
    return out;
  };
})();

interface Behavior {
  durN: number;
  motionN: number;
  dwellN: number;
  conf: number;
}

function computeBehaviors(recs: TrackletRecord[], space: CoordSpace): Map<string, Behavior> {
  const raw: { key: string; dur: number; speed: number; dwell: number; conf: number }[] = [];
  const nx = (x: number) => x / (space.normalized ? 1 : space.srcW || 1);
  const ny = (y: number) => y / (space.normalized ? 1 : space.srcH || 1);
  for (const rec of recs) {
    const tr = trajOf(rec);
    let path = 0;
    let still = 0;
    let segs = 0;
    for (let i = 1; i < tr.length; i++) {
      const dx = nx((tr[i].x1 + tr[i].x2) / 2) - nx((tr[i - 1].x1 + tr[i - 1].x2) / 2);
      const dy = ny((tr[i].y1 + tr[i].y2) / 2) - ny((tr[i - 1].y1 + tr[i - 1].y2) / 2);
      const d = Math.hypot(dx, dy);
      path += d;
      segs += 1;
      if (d < 0.01) still += 1;
    }
    const trSpan = tr.length > 1 ? tr[tr.length - 1].timestamp_sec - tr[0].timestamp_sec : 0;
    const dur = Math.max(rec.end_time_sec - rec.start_time_sec, trSpan, 0.5);
    raw.push({
      key: keyOf(rec),
      dur,
      speed: path / dur,
      dwell: segs > 0 ? still / segs : 0,
      conf: clamp(simOf(rec) ?? 0.5, 0, 1),
    });
  }
  const maxDur = Math.max(...raw.map((r) => r.dur), 0.5);
  const maxSpeed = Math.max(...raw.map((r) => r.speed), 1e-6);
  const out = new Map<string, Behavior>();
  raw.forEach((r) =>
    out.set(r.key, {
      durN: r.dur / maxDur,
      motionN: r.speed / maxSpeed,
      dwellN: r.dwell,
      conf: r.conf,
    })
  );
  return out;
}

interface RankResult {
  ranked: RankedTracklet[];
  meta: SearchMeta;
}

function rankTracklets(
  recs: TrackletRecord[],
  query: string,
  backendSim: Map<string, number>,
  space: CoordSpace
): RankResult {
  const behaviors = computeBehaviors(recs, space);
  const tokens = tokenize(query);
  const hasQuery = tokens.length > 0;
  const intents = INTENTS.filter((i) => tokens.some((t) => i.triggerSet.has(t)));

  let maxRaw = 0;
  const scored = recs.map((rec) => {
    const key = keyOf(rec);
    const b = behaviors.get(key) ?? { durN: 0, motionN: 0, dwellN: 0, conf: 0.5 };
    const idx = indexOf(rec);
    const cls = (rec.object_class || "object").toLowerCase();
    const reasons: string[] = [];

    let lexSum = 0;
    if (hasQuery) {
      tokens.forEach((tk) => {
        if (idx.cls.has(tk)) {
          lexSum += 1;
          if (!reasons.includes("CLASS")) reasons.push("CLASS");
        } else if (idx.gem.has(tk) || (tk.length >= 4 && idx.gemText.includes(tk))) {
          lexSum += 0.7;
          if (!reasons.includes("VLM TEXT")) reasons.push("VLM TEXT");
        } else if (idx.oth.has(tk) || (tk.length >= 4 && idx.othText.includes(tk))) {
          lexSum += 0.5;
          if (!reasons.includes("ATTR")) reasons.push("ATTR");
        }
      });
    }
    const lexical = hasQuery ? clamp(lexSum / tokens.length, 0, 1) : 0;

    let intentScore = 0;
    let bestIntent: Intent | null = null;
    intents.forEach((it) => {
      const cb = it.classBias[cls] ?? 0;
      let hintHits = 0;
      it.hintSet.forEach((h) => {
        if (idx.gem.has(h) || idx.oth.has(h)) hintHits += 1;
      });
      const hintScore = clamp(hintHits / 2, 0, 1);
      const behaviorScore = it.w.motion * b.motionN + it.w.dwell * b.dwellN + it.w.dur * b.durN;
      const s = 0.3 * cb + 0.25 * hintScore + 0.45 * behaviorScore;
      if (s >= intentScore) {
        intentScore = s;
        bestIntent = it;
      }
    });
    if (bestIntent) reasons.push(`INTENT: ${(bestIntent as Intent).label}`);
    if (intents.length > 0 && b.motionN > 0.66) reasons.push("HIGH MOTION");
    if (intents.length > 0 && b.dwellN > 0.66) reasons.push("DWELL");

    const sim = backendSim.get(key);
    if (sim !== undefined) reasons.push("SIGLIP");

    const baseline = 0.06 * b.conf + 0.04 * b.durN;
    const raw =
      (intents.length > 0 ? 0.35 * lexical + 0.45 * intentScore : 0.65 * lexical) +
      (sim !== undefined ? 0.35 * sim : 0) +
      baseline;
    maxRaw = Math.max(maxRaw, raw);

    return { rec, raw, lexical, sim, reasons, b };
  });

  let ordered = scored;
  if (hasQuery) {
    ordered = [...scored].sort((a, c) => c.raw - a.raw || a.rec.start_time_sec - c.rec.start_time_sec);
  } else {
    ordered = [...scored].sort((a, c) => a.rec.start_time_sec - c.rec.start_time_sec);
  }

  const ranked: RankedTracklet[] = ordered.map((s) => ({
    ...s.rec,
    _score: hasQuery ? (maxRaw > 0 ? s.raw / maxRaw : 0) : undefined,
    _reasons: s.reasons.slice(0, 4),
    _motion: s.b.motionN,
    _dwell: s.b.dwellN,
  }));

  const exact = scored.filter((s) => s.lexical > 0 || s.sim !== undefined).length;
  const sims = scored.filter((s) => s.sim !== undefined).length;

  let mode = "CHRONOLOGICAL INDEX";
  if (hasQuery) {
    if (sims > 0) mode = "SIGLIP + SEMANTIC FUSION";
    else if (exact > 0) mode = "ATTRIBUTE MATCH";
    else if (intents.length > 0) mode = "SEMANTIC INTENT MODEL";
    else mode = "BEHAVIORAL RANKING";
  }

  let note: string | null = null;
  if (hasQuery && exact === 0 && recs.length > 0) {
    const basis = intents.length > 0 ? intents.map((i) => i.label.toLowerCase()).join(" + ") + " intent model" : "motion, dwell and confidence";
    note = `No literal attribute match for "${query.trim()}". All ${recs.length} tracklets are ranked by ${basis}.`;
  }

  return { ranked, meta: { mode, note, total: recs.length, exact, intents: intents.map((i) => i.label) } };
}

/* ============================================================================
 * UI atoms
 * ========================================================================== */
const Readout: React.FC<{ label: string; value: React.ReactNode; tone?: string; title?: string }> = ({
  label,
  value,
  tone = "text-slate-200",
  title,
}) => (
  <div className="min-w-0 border-l border-slate-800 pl-2.5" title={title}>
    <div className="text-[8px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
    <div className={`truncate text-[11px] font-semibold tabular-nums ${tone}`}>{value}</div>
  </div>
);

/* ============================================================================
 * Component
 * ========================================================================== */
export const SearchAndPlayer: React.FC<SearchAndPlayerProps> = ({
  initialTracklets = EMPTY_TRACKLETS,
  activeVideoUrl = "/sample_cctv_feed.mp4",
  activeTracklets = null,
  videoFile = null,
}) => {
  /* ---- state ---- */
  const [query, setQuery] = useState("");
  const [cameraFilter, setCameraFilter] = useState<string>("ALL");
  const [results, setResults] = useState<RankedTracklet[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [videoError, setVideoError] = useState(false);
  const [thumbErrors, setThumbErrors] = useState<Record<string, boolean>>({});
  const [showOthers, setShowOthers] = useState(true);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [contentRect, setContentRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  /* ---- refs ---- */
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastUiRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const searchTokenRef = useRef(0);

  const resultsRef = useRef<RankedTracklet[]>([]);
  const selectedKeyRef = useRef<string | null>(null);
  const showOthersRef = useRef(true);
  const durationRef = useRef(0);
  const queryRef = useRef("");
  const cameraRef = useRef("ALL");
  const speedRef = useRef(1);
  const universeRef = useRef<TrackletRecord[]>(EMPTY_TRACKLETS);
  const spaceRef = useRef<CoordSpace>({ normalized: false, srcW: 1280, srcH: 720 });

  /* ---- derived ---- */
  const universe = useMemo<TrackletRecord[]>(
    () => (activeTracklets && activeTracklets.length > 0 ? activeTracklets : initialTracklets),
    [activeTracklets, initialTracklets]
  );

  const selectedTracklet = useMemo<RankedTracklet | null>(
    () => results.find((r) => keyOf(r) === selectedKey) ?? null,
    [results, selectedKey]
  );

  const cameraOptions = useMemo(() => {
    const set = new Set<string>();
    universe.forEach((t) => t.camera_id && set.add(t.camera_id));
    results.forEach((t) => t.camera_id && set.add(t.camera_id));
    return Array.from(set).sort();
  }, [universe, results]);

  const space = useMemo(
    () => inferSourceSpace(universe.length > 0 ? universe : results, videoDims.w || 1280, videoDims.h || 720),
    [universe, results, videoDims]
  );

  /* keep refs mirrored */
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);
  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);
  useEffect(() => {
    showOthersRef.current = showOthers;
  }, [showOthers]);
  useEffect(() => {
    spaceRef.current = space;
  }, [space]);

  /* ======================================================================
   * Canvas HUD renderer. The canvas backing store is locked to the video's
   * native resolution, so all coordinates are drawn in video-pixel space.
   * ==================================================================== */
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }
    ctx.clearRect(0, 0, vw, vh);

    const t = video.currentTime;
    const sp = spaceRef.current;
    const lw = Math.max(1.5, vw / 640);
    const fs = Math.max(10, Math.round(vh / 52));
    const selKey = selectedKeyRef.current;

    // Secondary tracks
    if (showOthersRef.current) {
      for (const rec of resultsRef.current) {
        if (keyOf(rec) === selKey) continue;
        const pt = sampleTrack(rec, t, 0.75);
        if (!pt) continue;
        const b = toVideoBox(pt, sp, vw, vh);
        const w = b.x2 - b.x1;
        const h = b.y2 - b.y1;
        ctx.strokeStyle = "rgba(245,158,11,0.45)";
        ctx.lineWidth = lw * 0.7;
        ctx.setLineDash([lw * 3, lw * 3]);
        ctx.strokeRect(b.x1, b.y1, w, h);
        ctx.setLineDash([]);
        drawBrackets(ctx, b.x1, b.y1, w, h, clamp(Math.min(w, h) * 0.22, 5 * lw, 18 * lw), "rgba(245,158,11,0.85)", lw);
        drawTag(ctx, `#${rec.track_id} ${(rec.object_class || "obj").toUpperCase()}`, b.x1, b.y1, fs * 0.85, "#fbbf24", "rgba(5,7,11,0.78)");
      }
    }

    // Primary track
    const sel = resultsRef.current.find((r) => keyOf(r) === selKey);
    if (sel) {
      const tr = trajOf(sel);
      const color = sel.is_ir_night_mode ? "#c084fc" : "#22d3ee";
      const tagBg = sel.is_ir_night_mode ? "rgba(88,28,135,0.92)" : "rgba(8,89,112,0.92)";

      // Foot-point trail up to the playhead
      ctx.beginPath();
      let started = false;
      for (const p of tr) {
        if (p.timestamp_sec > t) break;
        const bb = toVideoBox(p, sp, vw, vh);
        const cx = (bb.x1 + bb.x2) / 2;
        if (!started) {
          ctx.moveTo(cx, bb.y2);
          started = true;
        } else {
          ctx.lineTo(cx, bb.y2);
        }
      }
      if (started) {
        ctx.strokeStyle = "rgba(250,204,21,0.8)";
        ctx.lineWidth = lw;
        ctx.stroke();
      }

      const pt = sampleTrack(sel, t, 0.75);
      if (pt) {
        const b = toVideoBox(pt, sp, vw, vh);
        const w = b.x2 - b.x1;
        const h = b.y2 - b.y1;
        ctx.fillStyle = sel.is_ir_night_mode ? "rgba(192,132,252,0.08)" : "rgba(34,211,238,0.08)";
        ctx.fillRect(b.x1, b.y1, w, h);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.strokeRect(b.x1, b.y1, w, h);
        drawBrackets(ctx, b.x1, b.y1, w, h, clamp(Math.min(w, h) * 0.28, 8 * lw, 30 * lw), color, lw * 2);

        const sim = simOf(sel);
        const conf = sim !== undefined ? ` ${(sim * 100).toFixed(0)}%` : "";
        drawTag(ctx, `#${sel.track_id} ${(sel.object_class || "obj").toUpperCase()}${conf}`, b.x1, b.y1, fs, "#ffffff", tagBg);

        // Center reticle
        const cx = (b.x1 + b.x2) / 2;
        const cy = (b.y1 + b.y2) / 2;
        const r = Math.max(5, Math.min(w, h) * 0.06);
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy + r);
        ctx.stroke();
      }
    }
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    const tick = (now: number) => {
      drawFrame();
      const v = videoRef.current;
      if (v && now - lastUiRef.current > 90) {
        lastUiRef.current = now;
        setCurrentTime(v.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [drawFrame, stopLoop]);

  useEffect(() => stopLoop, [stopLoop]);

  /* Redraw whenever overlay inputs change while paused */
  useEffect(() => {
    drawFrame();
  }, [results, selectedKey, showOthers, space, contentRect, drawFrame]);

  /* ---- letterbox-aware canvas placement ---- */
  const computeRect = useCallback(() => {
    const box = stageRef.current;
    const v = videoRef.current;
    if (!box) return;
    const cw = box.clientWidth;
    const ch = box.clientHeight;
    const vw = v?.videoWidth || 0;
    const vh = v?.videoHeight || 0;
    let next = { left: 0, top: 0, width: cw, height: ch };
    if (vw && vh && cw && ch) {
      const scale = Math.min(cw / vw, ch / vh);
      const w = vw * scale;
      const h = vh * scale;
      next = { left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h };
    }
    setContentRect((prev) =>
      prev &&
      Math.abs(prev.left - next.left) < 0.5 &&
      Math.abs(prev.top - next.top) < 0.5 &&
      Math.abs(prev.width - next.width) < 0.5 &&
      Math.abs(prev.height - next.height) < 0.5
        ? prev
        : next
    );
  }, []);

  useEffect(() => {
    computeRect();
    const box = stageRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => computeRect());
    ro.observe(box);
    return () => ro.disconnect();
  }, [computeRect]);

  /* ======================================================================
   * Transport
   * ==================================================================== */
  const seekTo = useCallback(
    (timeSec: number) => {
      const v = videoRef.current;
      if (!v) return;
      const t = Math.max(0, Number.isFinite(timeSec) ? timeSec : 0);
      if (v.readyState < 1) {
        // Metadata not parsed yet: queue the seek; onLoadedMetadata applies it.
        pendingSeekRef.current = t;
        setCurrentTime(t);
        return;
      }
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : durationRef.current;
      const clamped = dur > 0 ? clamp(t, 0, dur) : t;
      v.currentTime = clamped;
      setCurrentTime(clamped);
      drawFrame();
    },
    [drawFrame]
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    const v = videoRef.current;
    speedRef.current = speed;
    setPlaybackSpeed(speed);
    if (v) v.playbackRate = speed;
  }, []);

  const handleJump = useCallback(
    (rec: TrackletRecord) => {
      setSelectedKey(keyOf(rec));
      selectedKeyRef.current = keyOf(rec);
      seekTo(typeof rec.best_timestamp_sec === "number" ? rec.best_timestamp_sec : rec.start_time_sec ?? 0);
    },
    [seekTo]
  );

  const stepSelection = useCallback(
    (dir: 1 | -1) => {
      const list = resultsRef.current;
      if (list.length === 0) return;
      const i = list.findIndex((r) => keyOf(r) === selectedKeyRef.current);
      const next = list[(i + dir + list.length) % list.length];
      handleJump(next);
    },
    [handleJump]
  );

  /* ======================================================================
   * Search
   * ==================================================================== */
  const fetchIndex = useCallback(
    async (text: string, topK: number, camera: string | null): Promise<TrackletRecord[] | null> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(`${API_BASE}/api/search/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text, top_k: topK, camera_filter: camera }),
          signal: ctrl.signal,
        });
        if (!res.ok) return null;
        const data: SearchResponse = await res.json();
        return data.results ?? [];
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
    []
  );

  const applyRanked = useCallback(
    (ranked: RankedTracklet[], meta: SearchMeta | null, autoSelect = true) => {
      setResults(ranked);
      resultsRef.current = ranked;
      setSearchMeta(meta);
      if (ranked.length === 0) {
        setSelectedKey(null);
        selectedKeyRef.current = null;
        return;
      }
      if (autoSelect) {
        const best = ranked[0];
        setSelectedKey(keyOf(best));
        selectedKeyRef.current = keyOf(best);
        seekTo(typeof best.best_timestamp_sec === "number" ? best.best_timestamp_sec : best.start_time_sec ?? 0);
      }
    },
    [seekTo]
  );

  const runSearch = useCallback(
    async (override?: string) => {
      const q = (override !== undefined ? override : queryRef.current).trim();
      const camera = cameraRef.current;
      const token = ++searchTokenRef.current;
      setIsSearching(true);
      setSearchError(null);

      try {
        const uni = universeRef.current;
        const hits = await fetchIndex(q, 12, camera === "ALL" ? null : camera);
        if (token !== searchTokenRef.current) return;

        const backendHits = hits ?? [];
        const sims = new Map<string, number>();
        backendHits.forEach((h) => {
          const s = simOf(h);
          if (s !== undefined) sims.set(keyOf(h), s);
        });

        // Candidate universe: the uploaded video's tracklets, else the backend's full index.
        let corpus: TrackletRecord[] = uni;
        if (corpus.length === 0) {
          const all = await fetchIndex("", 60, null);
          if (token !== searchTokenRef.current) return;
          corpus = all && all.length > 0 ? all : backendHits;
        } else {
          const known = new Set(corpus.map(keyOf));
          const extra = backendHits.filter((h) => !known.has(keyOf(h)));
          if (extra.length > 0) corpus = [...corpus, ...extra];
        }

        if (camera !== "ALL") corpus = corpus.filter((r) => r.camera_id === camera);

        if (corpus.length === 0) {
          applyRanked([], null);
          setSearchError(
            hits === null && uni.length === 0
              ? "Backend unreachable and no tracklets are loaded. Ingest footage in tab 01 or start the API on :8000."
              : camera !== "ALL"
              ? `No tracklets recorded on ${camera}. Switch the camera filter to ALL.`
              : "No tracklets are indexed for this video yet."
          );
          return;
        }

        const corpusSpace = inferSourceSpace(
          corpus,
          videoRef.current?.videoWidth || 1280,
          videoRef.current?.videoHeight || 720
        );
        const ranking = rankTracklets(corpus, q, sims, corpusSpace);
        applyRanked(ranking.ranked, ranking.meta);
      } finally {
        if (token === searchTokenRef.current) setIsSearching(false);
      }
    },
    [applyRanked, fetchIndex]
  );

  const handleImageSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const token = ++searchTokenRef.current;
    setIsSearching(true);
    setSearchError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("top_k", "8");
      let hits: TrackletRecord[] = [];
      try {
        const res = await fetch(`${API_BASE}/api/search/image`, { method: "POST", body: formData });
        if (res.ok) {
          const data: SearchResponse = await res.json();
          hits = data.results ?? [];
        }
      } catch {
        /* backend unreachable: handled below */
      }
      if (token !== searchTokenRef.current) return;

      if (hits.length > 0) {
        const ranked: RankedTracklet[] = [...hits]
          .sort((a, b) => (simOf(b) ?? 0) - (simOf(a) ?? 0))
          .map((h) => ({ ...h, _score: simOf(h), _reasons: ["PHOTO SIMILARITY"] }));
        applyRanked(ranked, { mode: "PHOTO SIMILARITY (SIGLIP)", note: null, total: ranked.length, exact: ranked.length, intents: [] });
      } else if (universeRef.current.length > 0) {
        const ranking = rankTracklets(universeRef.current, "", new Map(), spaceRef.current);
        applyRanked(ranking.ranked, {
          ...ranking.meta,
          note: `Photo index returned no match for ${file.name}. Showing all ${ranking.ranked.length} tracklets chronologically.`,
        });
      } else {
        setSearchError("Photo search returned nothing and no tracklets are loaded.");
      }
    } finally {
      if (token === searchTokenRef.current) setIsSearching(false);
      input.value = "";
    }
  };

  /* ======================================================================
   * Lifecycle effects
   * ==================================================================== */
  // New video: reset the player and search state.
  useEffect(() => {
    setVideoError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    durationRef.current = 0;
    setVideoDims({ w: 0, h: 0 });
    setQuery("");
    queryRef.current = "";
    setCameraFilter("ALL");
    cameraRef.current = "ALL";
    pendingSeekRef.current = null;
    stopLoop();
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }, [activeVideoUrl, stopLoop]);

  // New tracklets (upload, backend hydration) or new video: (re)run search over the live universe.
  useEffect(() => {
    universeRef.current = universe;
    void runSearch(queryRef.current);
  }, [universe, activeVideoUrl, runSearch]);

  // Keyboard: Ctrl/Cmd+F focuses search, Space toggles playback.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (e.code === "Space" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && tag !== "BUTTON") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  // Keep the selected card visible.
  useEffect(() => {
    if (!selectedTracklet) return;
    document.getElementById(domIdOf(selectedTracklet))?.scrollIntoView({ block: "nearest" });
  }, [selectedTracklet]);

  /* ---- video element handlers ---- */
  const applyDuration = (v: HTMLVideoElement) => {
    let d = v.duration;
    if (!Number.isFinite(d) || d <= 0) {
      // Some containers (streamed / MediaRecorder WebM) report Infinity: fall back to the tracklet horizon.
      const horizon = Math.max(0, ...universeRef.current.map((t) => t.end_time_sec || 0));
      d = horizon;
    }
    durationRef.current = d;
    setDuration(d);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    applyDuration(v);
    setVideoDims({ w: v.videoWidth, h: v.videoHeight });
    setVideoError(false);
    const c = canvasRef.current;
    if (c && v.videoWidth && v.videoHeight) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    }
    v.playbackRate = speedRef.current;
    computeRect();
    if (pendingSeekRef.current !== null) {
      const d = durationRef.current;
      v.currentTime = d > 0 ? clamp(pendingSeekRef.current, 0, d) : pendingSeekRef.current;
      setCurrentTime(v.currentTime);
      pendingSeekRef.current = null;
    }
    drawFrame();
  };

  /* ---- derived render data ---- */
  const liveBox = useMemo(() => {
    if (!selectedTracklet || !videoDims.w || !videoDims.h) return null;
    const pt = sampleTrack(selectedTracklet, currentTime, 0.75);
    return pt ? toVideoBox(pt, space, videoDims.w, videoDims.h) : null;
  }, [selectedTracklet, currentTime, space, videoDims]);

  const activeNow = useMemo(
    () => results.filter((r) => sampleTrack(r, currentTime, 0.75) !== null).length,
    [results, currentTime]
  );

  const lanes = useMemo(() => {
    if (!duration) return { items: [] as { rec: RankedTracklet; lane: number }[], count: 0 };
    const sorted = [...results].sort((a, b) => a.start_time_sec - b.start_time_sec);
    const ends: number[] = [];
    const items: { rec: RankedTracklet; lane: number }[] = [];
    for (const rec of sorted) {
      let lane = ends.findIndex((e) => e <= rec.start_time_sec);
      if (lane === -1) {
        if (ends.length < 5) {
          ends.push(rec.end_time_sec);
          lane = ends.length - 1;
        } else {
          lane = 4;
          ends[4] = Math.max(ends[4], rec.end_time_sec);
        }
      } else {
        ends[lane] = rec.end_time_sec;
      }
      items.push({ rec, lane });
    }
    return { items, count: ends.length };
  }, [results, duration]);

  const handleQuerySubmit = () => {
    void runSearch();
  };

  const applyPreset = (q: string) => {
    setQuery(q);
    queryRef.current = q;
    void runSearch(q);
  };

  const clearQuery = () => {
    setQuery("");
    queryRef.current = "";
    void runSearch("");
    searchInputRef.current?.focus();
  };

  const stageCanvasStyle: React.CSSProperties = contentRect
    ? { left: contentRect.left, top: contentRect.top, width: contentRect.width, height: contentRect.height }
    : { left: 0, top: 0, width: "100%", height: "100%" };

  const sel = selectedTracklet;
  const selSim = sel ? simOf(sel) : undefined;

  /* ======================================================================
   * Render
   * ==================================================================== */
  return (
    <div className="flex flex-col gap-3 font-mono text-slate-200">
      <style>{`@keyframes hawkScan{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
@media (prefers-reduced-motion: reduce){.hawk-anim{animation:none !important}}`}</style>

      {/* ============ QUERY CONSOLE ============ */}
      <section className="relative overflow-hidden rounded-sm border border-cyan-500/25 bg-[#080C12]">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-slate-500">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-cyan-400" />
            Forensic query console
          </span>
          <span className="tabular-nums">
            {isSearching ? (
              <span className="text-cyan-300">Scanning index</span>
            ) : searchMeta ? (
              <>
                {searchMeta.total} tracklets <span className="text-slate-700">|</span>{" "}
                <span className="text-cyan-400">{searchMeta.mode}</span>
              </>
            ) : (
              "Idle"
            )}
          </span>
        </div>

        <div className="flex flex-col gap-2 p-2.5 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search surveillance footage"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                queryRef.current = e.target.value;
              }}
              onKeyDown={(e) => e.key === "Enter" && handleQuerySubmit()}
              placeholder="Query the uploaded video: theft, person in jacket, backpack, aisle, suspicious…"
              className="h-9 w-full rounded-sm border border-slate-700/80 bg-[#05070B] pl-9 pr-24 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              {query && (
                <button
                  onClick={clearQuery}
                  aria-label="Clear query"
                  className="rounded-sm p-0.5 text-slate-500 hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <span className="select-none rounded-sm border border-slate-800 px-1.5 py-0.5 text-[9px] text-slate-500">CTRL+F</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filter results by camera"
              value={cameraFilter}
              onChange={(e) => {
                setCameraFilter(e.target.value);
                cameraRef.current = e.target.value;
                void runSearch();
              }}
              className="h-9 rounded-sm border border-slate-700/80 bg-[#05070B] px-2.5 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              <option value="ALL">ALL CAMERAS</option>
              {cameraOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              aria-label="Upload reference photo"
              onChange={handleImageSearch}
              className="hidden"
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex h-9 items-center gap-1.5 rounded-sm border border-slate-700 bg-slate-900/70 px-3 text-xs font-bold text-slate-300 transition hover:border-violet-400 hover:text-violet-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
              title="Image-to-image SigLIP similarity search"
            >
              <ImageIcon className="h-3.5 w-3.5 text-violet-400" />
              PHOTO
            </button>

            <button
              onClick={handleQuerySubmit}
              disabled={isSearching}
              aria-label="Execute forensic query"
              aria-busy={isSearching}
              className={`relative flex h-9 min-w-[124px] items-center justify-center gap-1.5 overflow-hidden rounded-sm border px-4 text-xs font-bold tracking-wider transition focus:outline-none focus:ring-1 focus:ring-cyan-300 ${
                isSearching
                  ? "cursor-wait border-cyan-400 bg-cyan-500/20 text-cyan-200"
                  : "border-cyan-400 bg-cyan-500 text-[#021018] hover:bg-cyan-400"
              }`}
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  SCANNING
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  QUERY
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800 px-2.5 py-1.5 text-[10px]">
          <span className="mr-1 text-[9px] uppercase tracking-[0.16em] text-slate-600">Presets</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.query)}
              className={`rounded-sm border bg-[#05070B] px-2 py-0.5 font-semibold transition focus:outline-none focus:ring-1 focus:ring-cyan-400 ${p.tone}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {searchMeta?.note && !isSearching && (
          <div className="flex items-start gap-2 border-t border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[10px] text-amber-300">
            <AlertCircle className="mt-px h-3 w-3 shrink-0" />
            <span>{searchMeta.note}</span>
          </div>
        )}

        {isSearching && (
          <div
            className="hawk-anim absolute bottom-0 left-0 h-[2px] w-1/4 bg-cyan-400 shadow-[0_0_10px_#22d3ee]"
            style={{ animation: "hawkScan 1s linear infinite" }}
          />
        )}
      </section>

      {/* ============ MAIN WORKSPACE ============ */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_430px]">
        {/* ---- Player column ---- */}
        <section className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-sm border border-cyan-500/25 bg-[#080C12]">
            {/* Player header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#05070B] px-3 py-1.5 text-[11px]">
              <div className="flex min-w-0 items-center gap-2">
                <Camera className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                <span className="font-bold text-slate-200">FEED {sel?.camera_id ?? "—"}</span>
                {videoFile && (
                  <span className="max-w-[220px] truncate rounded-sm border border-cyan-900 bg-cyan-950/50 px-1.5 py-px text-[10px] text-cyan-300" title={videoFile.name}>
                    {videoFile.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOthers((s) => !s)}
                  aria-pressed={showOthers}
                  className={`flex items-center gap-1 rounded-sm border px-1.5 py-px text-[10px] font-semibold transition focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                    showOthers ? "border-amber-700 bg-amber-950/40 text-amber-300" : "border-slate-700 text-slate-500 hover:text-slate-300"
                  }`}
                  title="Toggle overlay of all concurrent tracks"
                >
                  <Layers className="h-3 w-3" />
                  ALL TRACKS
                </button>
                {sel?.is_ir_night_mode ? (
                  <span className="flex items-center gap-1 rounded-sm border border-violet-800 bg-violet-950/60 px-1.5 py-px text-[10px] text-violet-300">
                    <Moon className="h-3 w-3" />
                    IR NIGHT{sel.avg_saturation != null ? ` · SAT ${Number(sel.avg_saturation).toFixed(1)}` : ""}
                  </span>
                ) : sel && sel.avg_saturation != null ? (
                  <span className="rounded-sm border border-emerald-900 bg-emerald-950/40 px-1.5 py-px text-[10px] text-emerald-400">
                    RGB · SAT {Number(sel.avg_saturation).toFixed(1)}
                  </span>
                ) : null}
                <span className="font-bold tabular-nums text-cyan-300">{fmtClock(currentTime)}</span>
              </div>
            </div>

            {/* Stage */}
            <div ref={stageRef} className="relative h-[clamp(300px,56vh,720px)] w-full overflow-hidden bg-black">
              <video
                ref={videoRef}
                src={activeVideoUrl}
                playsInline
                muted
                preload="auto"
                onLoadedMetadata={handleLoadedMetadata}
                onDurationChange={(e) => applyDuration(e.currentTarget)}
                onResize={computeRect}
                onTimeUpdate={() => {
                  const v = videoRef.current;
                  if (v && v.paused) {
                    setCurrentTime(v.currentTime);
                    drawFrame();
                  }
                }}
                onSeeked={() => {
                  const v = videoRef.current;
                  if (v) setCurrentTime(v.currentTime);
                  drawFrame();
                }}
                onPlay={() => {
                  setIsPlaying(true);
                  startLoop();
                }}
                onPause={() => {
                  setIsPlaying(false);
                  stopLoop();
                  const v = videoRef.current;
                  if (v) setCurrentTime(v.currentTime);
                  drawFrame();
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  stopLoop();
                }}
                onError={() => setVideoError(true)}
                className="absolute inset-0 h-full w-full object-contain"
              />

              {/* Overlay canvas: backing store == native video pixels, CSS box == letterboxed video rect */}
              <canvas ref={canvasRef} className="pointer-events-none absolute" style={stageCanvasStyle} />

              {/* HUD furniture */}
              <div className="pointer-events-none absolute inset-0">
                <span className="absolute left-2 top-2 h-4 w-4 border-l border-t border-cyan-400/60" />
                <span className="absolute right-2 top-2 h-4 w-4 border-r border-t border-cyan-400/60" />
                <span className="absolute bottom-2 left-2 h-4 w-4 border-b border-l border-cyan-400/60" />
                <span className="absolute bottom-2 right-2 h-4 w-4 border-b border-r border-cyan-400/60" />

                <div className="absolute left-6 top-4 flex items-center gap-2 text-[10px] font-bold text-slate-200 [text-shadow:0_0_4px_#000]">
                  <span className={`h-2 w-2 rounded-full ${isPlaying ? "animate-pulse bg-rose-500" : "bg-slate-500"}`} />
                  {isPlaying ? "LIVE REVIEW" : "PAUSED"}
                  <span className="text-cyan-300">{playbackSpeed}x</span>
                </div>
                <div className="absolute right-6 top-4 text-[10px] font-bold tabular-nums text-cyan-200 [text-shadow:0_0_4px_#000]">
                  {fmtClock(currentTime)} / {duration ? fmtClock(duration) : "--:--.-"}
                </div>
                <div className="absolute bottom-4 left-6 text-[10px] font-semibold text-amber-300 [text-shadow:0_0_4px_#000]">
                  {activeNow} TRACK{activeNow === 1 ? "" : "S"} IN FRAME
                </div>
                <div className="absolute bottom-4 right-6 text-[10px] tabular-nums text-slate-300 [text-shadow:0_0_4px_#000]">
                  {videoDims.w ? `${videoDims.w}×${videoDims.h}` : "—"}
                </div>
              </div>

              {videoError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#05070B]/95 p-6 text-center">
                  <VideoOff className="h-8 w-8 text-amber-400" />
                  <div className="text-xs font-bold text-slate-200">VIDEO SOURCE UNAVAILABLE</div>
                  <p className="max-w-sm text-[11px] text-slate-400">
                    The browser could not load <span className="text-slate-200">{videoFile?.name ?? activeVideoUrl}</span>. Upload the footage again from the source bar.
                    Tracklet data and search stay available.
                  </p>
                </div>
              )}

              {!isPlaying && !videoError && (
                <button
                  onClick={togglePlay}
                  aria-label="Play surveillance feed"
                  className="absolute inset-0 flex items-center justify-center bg-black/25 focus:outline-none"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:bg-cyan-500/40">
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </span>
                </button>
              )}
            </div>

            {/* Timeline + transport */}
            <div className="space-y-2 border-t border-slate-800 bg-[#05070B] px-3 pb-2.5 pt-2">
              {lanes.count > 0 && (
                <div className="relative" style={{ height: lanes.count * 6 }} aria-label="Tracklet timeline">
                  {lanes.items.map(({ rec, lane }) => {
                    const left = clamp(rec.start_time_sec / duration, 0, 1) * 100;
                    const width = Math.min(100 - left, Math.max(0.7, ((rec.end_time_sec - rec.start_time_sec) / duration) * 100));
                    const isSel = keyOf(rec) === selectedKey;
                    return (
                      <button
                        key={keyOf(rec)}
                        onClick={() => handleJump(rec)}
                        title={`#${rec.track_id} ${rec.object_class} · ${fmtJump(rec.start_time_sec)}–${fmtJump(rec.end_time_sec)}`}
                        className={`absolute h-[4px] rounded-[1px] transition focus:outline-none ${
                          isSel ? "bg-cyan-300 shadow-[0_0_6px_#22d3ee]" : "bg-amber-500/55 hover:bg-amber-400"
                        }`}
                        style={{ left: `${left}%`, width: `${width}%`, top: lane * 6 }}
                      />
                    );
                  })}
                </div>
              )}

              <input
                type="range"
                aria-label="Timeline scrubber"
                min={0}
                max={duration || 0}
                step={0.05}
                disabled={!duration}
                value={Math.min(currentTime, duration || 0)}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400 focus:outline-none disabled:opacity-40"
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause [Space]" : "Play [Space]"}
                  className="rounded-sm border border-slate-700 bg-slate-900 p-1.5 text-slate-100 transition hover:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => seekTo(0)}
                  aria-label="Rewind to start"
                  className="rounded-sm border border-slate-700 bg-slate-900 p-1.5 text-slate-100 transition hover:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => stepSelection(-1)}
                  aria-label="Previous tracklet"
                  className="rounded-sm border border-slate-700 bg-slate-900 p-1.5 text-slate-100 transition hover:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  onClick={() => stepSelection(1)}
                  aria-label="Next tracklet"
                  className="rounded-sm border border-slate-700 bg-slate-900 p-1.5 text-slate-100 transition hover:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <SkipForward className="h-4 w-4" />
                </button>

                <div className="ml-1 flex items-center gap-1 text-[10px]">
                  {[0.5, 1, 2, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSpeedChange(s)}
                      className={`rounded-sm border px-1.5 py-0.5 font-bold focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                        playbackSpeed === s
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                          : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                <span className="ml-auto text-[11px] tabular-nums text-slate-400">
                  {fmtJump(currentTime)} / {duration ? fmtJump(duration) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Selected tracklet telemetry */}
          <div className="rounded-sm border border-slate-800 bg-[#080C12]">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-slate-500">
              <span className="flex items-center gap-2">
                <Crosshair className="h-3 w-3 text-cyan-400" />
                Target telemetry
              </span>
              <span>{sel ? `#${sel.track_id}` : "No target"}</span>
            </div>
            {sel ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-3 sm:grid-cols-4 xl:grid-cols-6">
                <Readout label="Class" value={(sel.object_class || "—").toUpperCase()} tone="text-cyan-300" />
                <Readout label="Camera" value={sel.camera_id} />
                <Readout label="Span" value={`${fmtJump(sel.start_time_sec)}–${fmtJump(sel.end_time_sec)}`} />
                <Readout label="Duration" value={`${Math.max(0, sel.end_time_sec - sel.start_time_sec).toFixed(1)}s`} />
                <Readout label="Track points" value={trajOf(sel).length} />
                <Readout label="SigLIP sim" value={selSim !== undefined ? `${(selSim * 100).toFixed(1)}%` : "—"} tone={selSim !== undefined ? "text-emerald-300" : "text-slate-500"} />
                <Readout label="Motion idx" value={sel._motion !== undefined ? `${Math.round(sel._motion * 100)}%` : "—"} tone="text-violet-300" title="Relative to the other tracklets in the current result set" />
                <Readout label="Dwell ratio" value={sel._dwell !== undefined ? `${Math.round(sel._dwell * 100)}%` : "—"} tone="text-amber-300" title="Share of trajectory segments with near-zero displacement" />
                <Readout label="Box X,Y" value={liveBox ? `${Math.round(liveBox.x1)},${Math.round(liveBox.y1)}` : "off-frame"} />
                <Readout label="Box W×H" value={liveBox ? `${Math.round(liveBox.x2 - liveBox.x1)}×${Math.round(liveBox.y2 - liveBox.y1)}` : "—"} />
                <Readout
                  label="Coord space"
                  value={space.normalized ? "normalized 0..1" : `${Math.round(space.srcW)}×${Math.round(space.srcH)} px`}
                  tone="text-slate-400"
                />
                <Readout label="Active now" value={`${activeNow}/${results.length}`} />
              </div>
            ) : (
              <div className="p-3 text-[11px] text-slate-500">Select a tracklet from the ranked feed to lock the HUD onto it.</div>
            )}
          </div>

          {/* Stage 4 audit */}
          <div className="rounded-sm border border-slate-800 bg-[#080C12]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-1 text-[9px] uppercase tracking-[0.18em]">
              <span className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Stage 4 · Gemini 2.5 Flash audit
              </span>
              <span className="normal-case tracking-normal text-slate-400" title={sel?.sha256_frame_hash || undefined}>
                SHA-256{" "}
                {sel?.sha256_frame_hash ? (
                  <span className="text-slate-200">{sel.sha256_frame_hash.substring(0, 24)}…</span>
                ) : (
                  <span className="text-amber-400">unsigned (no frame hash on record)</span>
                )}
              </span>
            </div>
            <div className="p-3 text-[11px] leading-relaxed text-slate-300">
              {sel ? (
                sel.gemini_verification ? (
                  sel.gemini_verification
                ) : (
                  <span className="text-slate-500">No Stage 4 verification is attached to this tracklet.</span>
                )
              ) : (
                <span className="text-slate-500">Select a tracklet to read its verification.</span>
              )}
            </div>
          </div>
        </section>

        {/* ---- Ranked feed ---- */}
        <aside className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-sm border border-cyan-500/25 bg-[#080C12] xl:h-[calc(100vh-290px)]">
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#05070B] px-3 py-1.5">
            <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-200">
              <span className="h-1.5 w-1.5 bg-cyan-400" />
              Ranked tracklets
              <span className="tabular-nums text-cyan-400">{results.length}</span>
            </h3>
            <span className="text-[9px] uppercase tracking-[0.14em] text-slate-500">
              {searchMeta ? (searchMeta.mode === "CHRONOLOGICAL INDEX" ? "By time" : "By relevance") : "—"}
            </span>
          </div>

          {isSearching && results.length === 0 && (
            <div className="animate-pulse space-y-2 p-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 rounded-sm border border-slate-800 p-2.5">
                  <div className="h-14 w-20 bg-slate-800/80" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 bg-slate-800/80" />
                    <div className="h-2.5 w-1/2 bg-slate-800/80" />
                    <div className="h-2.5 w-5/6 bg-slate-800/80" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isSearching && results.length === 0 && (
            <div className="m-2.5 space-y-2.5 rounded-sm border border-slate-800 bg-[#05070B] p-5 text-center text-xs">
              <AlertCircle className="mx-auto h-6 w-6 text-amber-400" />
              <div className="font-bold text-slate-200">NO TRACKLETS INDEXED</div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                {searchError ?? "Ingest footage in tab 01 to index tracklets, or sync the backend index."}
              </p>
              <button
                onClick={() => void runSearch("")}
                className="rounded-sm border border-cyan-400 bg-cyan-500 px-3 py-1.5 text-[11px] font-bold text-[#021018] transition hover:bg-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-300"
              >
                RETRY INDEX SYNC
              </button>
            </div>
          )}

          <div className={`min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 transition-opacity ${isSearching && results.length > 0 ? "opacity-60" : "opacity-100"}`}>
            {results.map((rec, i) => {
              const k = keyOf(rec);
              const isSel = k === selectedKey;
              const broken = thumbErrors[k] || !rec.crop_url;
              const sim = simOf(rec);
              const score = rec._score;
              const pct = sim !== undefined ? sim : score;
              const span = Math.max(0, rec.end_time_sec - rec.start_time_sec);
              const jumpAt = typeof rec.best_timestamp_sec === "number" ? rec.best_timestamp_sec : rec.start_time_sec;
              return (
                <div
                  key={k}
                  id={domIdOf(rec)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select tracklet ${rec.track_id} ${rec.object_class}`}
                  aria-pressed={isSel}
                  onClick={() => handleJump(rec)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleJump(rec);
                    }
                  }}
                  className={`cursor-pointer rounded-sm border p-2 text-xs transition focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                    isSel
                      ? "border-cyan-400 bg-cyan-950/30 shadow-[inset_2px_0_0_#22d3ee]"
                      : "border-slate-800 bg-[#05070B] hover:border-slate-600"
                  }`}
                >
                  <div className="flex gap-2.5">
                    <div className="relative flex h-[58px] w-[84px] shrink-0 items-center justify-center overflow-hidden border border-slate-800 bg-black">
                      {broken ? (
                        <div className="flex flex-col items-center text-center">
                          <span className="text-lg leading-none">{OBJECT_EMOJIS[rec.object_class] ?? "🔍"}</span>
                          <span className="mt-1 text-[8px] font-bold uppercase text-cyan-400">#{rec.track_id}</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rec.crop_url}
                          alt={`Tracklet ${rec.track_id}`}
                          onError={() => setThumbErrors((p) => ({ ...p, [k]: true }))}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <span className="absolute left-0 top-0 bg-black/70 px-1 text-[8px] tabular-nums text-slate-400">{String(i + 1).padStart(2, "0")}</span>
                      {rec.is_ir_night_mode && (
                        <span className="absolute right-0.5 top-0.5 rounded-sm border border-violet-800 bg-violet-950 px-1 text-[8px] text-violet-300">IR</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-bold uppercase text-slate-100">
                          {rec.object_class} #{rec.track_id}
                        </span>
                        {pct !== undefined ? (
                          <span
                            className={`shrink-0 rounded-sm border px-1.5 text-[10px] font-bold tabular-nums ${
                              sim !== undefined
                                ? "border-emerald-800 bg-emerald-950/60 text-emerald-300"
                                : "border-cyan-900 bg-cyan-950/50 text-cyan-300"
                            }`}
                            title={sim !== undefined ? "SigLIP inner-product similarity" : "Local semantic relevance within this result set"}
                          >
                            {(pct * 100).toFixed(0)}% {sim !== undefined ? "MATCH" : "REL"}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-sm border border-slate-700 px-1.5 text-[9px] font-bold text-slate-400">TRACKLET</span>
                        )}
                      </div>

                      {pct !== undefined && (
                        <div className="h-[3px] w-full bg-slate-800">
                          <div
                            className={sim !== undefined ? "h-full bg-emerald-400" : "h-full bg-cyan-400"}
                            style={{ width: `${clamp(pct, 0, 1) * 100}%` }}
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                        <span>
                          CAM <strong className="text-slate-300">{rec.camera_id}</strong>
                        </span>
                        <span>
                          SPAN <strong className="text-slate-300">{span.toFixed(1)}s</strong>
                        </span>
                        <span>
                          PTS <strong className="text-slate-300">{trajOf(rec).length}</strong>
                        </span>
                      </div>

                      {rec.gemini_verification && (
                        <p className="line-clamp-1 text-[10px] text-slate-500" title={rec.gemini_verification}>
                          {rec.gemini_verification}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {(rec._reasons ?? []).map((r) => (
                            <span key={r} className="rounded-sm border border-slate-800 bg-slate-900/70 px-1 text-[8px] uppercase tracking-wide text-slate-400">
                              {r}
                            </span>
                          ))}
                        </div>
                        <span className="shrink-0 text-[10px] font-bold tabular-nums text-cyan-400">JUMP @ {fmtJump(jumpAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SearchAndPlayer;