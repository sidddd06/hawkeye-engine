/**
 * frontend/src/types/contract.ts
 * LOCKED SHARED CONTRACT - DO NOT MODIFY WITHOUT TEAM LEADER AUTHORIZATION
 * Strict 100% snake_case JSON alignment with backend/schemas.py
 */

export interface BBoxPoint {
  timestamp_sec: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
}

export interface TrackletRecord {
  track_id: number;
  camera_id: string;
  start_time_sec: number;
  end_time_sec: number;
  best_timestamp_sec: number;
  object_class: string;
  crop_url: string;
  is_ir_night_mode: boolean;
  avg_saturation: number;
  trajectory: BBoxPoint[];
  similarity_score?: number | null;
  gemini_verification?: string | null;
  sha256_frame_hash: string;
}

export type SieveStatus = "IDLE" | "INDEXING" | "COMPLETED" | "ERROR";

export interface SieveTelemetry {
  status: SieveStatus;
  raw_frames_total: number;
  keyframes_checked: number;
  motion_frames_woken: number;
  unique_tracklets: number;
  elapsed_sec: number;
  gpu_device_name: string;
}

export interface TripwireQuery {
  camera_id: string;
  polygon_points: [number, number][];
  min_dwell_sec?: number;
}

export interface EscapeVectorNode {
  camera_id: string;
  camera_name: string;
  lat: number;
  lng: number;
  timestamp_sec: number;
  crop_url: string;
  est_speed_kmh?: number | null;
}

// Supporting API Interfaces

export interface TextSearchQuery {
  query: string;
  top_k?: number;
  camera_filter?: string | null;
}

export interface SearchResponse {
  query: string;
  total_matched: number;
  results: TrackletRecord[];
}

export interface TripwireResult {
  camera_id: string;
  polygon_points: [number, number][];
  violated: boolean;
  violating_tracklets: TrackletRecord[];
}

export interface EscapeMapResponse {
  track_id: number;
  nodes: EscapeVectorNode[];
  total_distance_km: number;
  avg_speed_kmh: number;
}

export interface SynopsisRequest {
  camera_id?: string;
  target_duration_sec?: number;
  speedup_factor?: number;
}

export interface SynopsisResponse {
  camera_id: string;
  synopsis_video_url: string;
  duration_sec: number;
  total_events_condensed: number;
  hud_tags: string[];
}

export interface DossierReport {
  track_id: number;
  camera_id: string;
  sha256_evidence_hash: string;
  timestamp_range: string;
  best_crop_url: string;
  gemini_verification?: string | null;
  trajectory_points_count: number;
  generated_at_utc: string;
}

export interface HealthResponse {
  status: string;
  gpu_device_name: string;
  gpu_vram_gb: number;
  loaded_tracklets_count: number;
  system_time: string;
}

export interface IndexVideoRequest {
  video_path: string;
  camera_id?: string;
}
