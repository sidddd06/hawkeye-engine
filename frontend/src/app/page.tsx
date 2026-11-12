"use client";

import React, { useState, useEffect } from "react";
import { 
  Cpu, 
  Search, 
  MapPin, 
  Film, 
  HardDrive, 
  Zap, 
  Shield, 
  Activity, 
  Moon,
  ExternalLink,
  Keyboard,
  CheckCircle,
  X,
  Play
} from "lucide-react";

import { IngestionTelemetry } from "@/components/member1_core/IngestionTelemetry";
import { SearchAndPlayer } from "@/components/member1_core/SearchAndPlayer";
import { PolygonTripwireCanvas } from "@/components/member2_spatial/PolygonTripwireCanvas";
import { MultiCamEscapeMap } from "@/components/member2_spatial/MultiCamEscapeMap";
import { SynopsisAndDossier } from "@/components/member2_spatial/SynopsisAndDossier";
import { PolygonTripwire } from "@/components/member2_spatial/PolygonTripwire";
import { MultiCamEscalation } from "@/components/member2_spatial/MultiCamEscalation";
import { ForensicSynopsisDossier } from "@/components/member2_spatial/ForensicSynopsisDossier";
import { HealthResponse } from "@/types/contract";

export default function ForensicCommandCenter() {
  const [viewMode, setViewMode] = useState<"member1" | "tripwire" | "multicam" | "synopsis">("member1");
  const [activeTab, setActiveTab] = useState<"ingestion" | "search" | "spatial" | "synopsis">("search");
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(true);
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false);
  const [demoNotification, setDemoNotification] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse>({
    status: "ONLINE",
    gpu_device_name: "NVIDIA GeForce RTX 4070 (8.0 GB VRAM)",
    gpu_vram_gb: 8.0,
    loaded_tracklets_count: 8,
    system_time: new Date().toISOString(),
  });

  const fetchHealth = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/health");
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
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // 1-Click Judge Demo Scenario Loader
  const handleLoadJudgeDemo = (scenarioName = "Noida Highway Motorcycle Escape") => {
    setViewMode("member1");
    setActiveTab("search");
    setShowDemoModal(false);
    setDemoNotification(`⚡ STAGE DEMO ACTIVATED: ${scenarioName.toUpperCase()} // NOIDA SEC-62`);
    setTimeout(() => setDemoNotification(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Tactical Top Forensic Header */}
      <header 
        role="banner" 
        className="border-b border-slate-800/80 bg-[#0b0f19]/90 backdrop-blur sticky top-0 z-50 px-6 py-3"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div 
              aria-hidden="true" 
              className="w-8 h-8 rounded bg-sky-500/10 border border-sky-400 flex items-center justify-center text-sky-400 font-bold shadow-[0_0_12px_rgba(56,189,248,0.3)] select-none"
            >
              🦅
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-wider font-mono text-slate-100 uppercase">
                  HAWKEYE // BOUNTYCAM
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 tracking-wide">
                  ZERO-CLOUD FORENSICS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                12-Hour CCTV Sieve &amp; Decentralized Bounty Search Engine
              </p>
            </div>
          </div>

          {/* Right Status Badges & Demo Button */}
          <div className="flex items-center gap-3">
            {/* Backend Connectivity Status Badge */}
            <div 
              aria-label={`Backend server status: ${isBackendOnline ? 'online' : 'air-gapped offline'}`}
              className="flex items-center gap-1.5 bg-[#111827] border border-slate-800 px-2.5 py-1.5 rounded font-mono text-[11px]"
            >
              <span className={`w-2 h-2 rounded-full ${isBackendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className={isBackendOnline ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {isBackendOnline ? 'API: ONLINE' : 'CLIENT AIR-GAPPED'}
              </span>
            </div>

            {/* GPU Live Badge */}
            <div 
              aria-label={`GPU Accelerator: ${health.gpu_device_name}`}
              className="hidden sm:flex items-center gap-2 bg-[#111827] border border-slate-800 px-3 py-1.5 rounded font-mono text-xs"
            >
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">GPU:</span>
              <span className="text-sky-300 font-semibold">{health.gpu_device_name}</span>
            </div>

            {/* Stage 4 Gemini Badge */}
            <div 
              aria-label="Stage 4 Gemini 2.5 Flash Precision Verifier Active"
              className="hidden md:flex items-center gap-1.5 bg-[#111827] border border-slate-800 px-2.5 py-1.5 rounded font-mono text-[11px] text-emerald-400"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>GEMINI 2.5 FLASH</span>
            </div>

            {/* 1-Click Judge Demo Button */}
            <button
              onClick={() => setShowDemoModal(true)}
              aria-label="Load Judge Live Demo Scenarios"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-mono font-bold text-xs rounded transition shadow-[0_0_15px_rgba(245,158,11,0.4)] focus:ring-2 focus:ring-amber-400 focus:outline-none"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              ⚡ LOAD JUDGE DEMO
            </button>
          </div>
        </div>
      </header>

      {/* Demo Notification Toast */}
      {demoNotification && (
        <div 
          role="status" 
          aria-live="polite"
          className="bg-amber-500 text-black px-4 py-2 font-mono text-xs font-bold text-center flex items-center justify-center gap-2 shadow-lg transition"
        >
          <Zap className="w-4 h-4 fill-black" />
          {demoNotification}
        </div>
      )}

      {/* Master View Mode Selector: Member 1 Core Dashboard vs Member 2 Spatial Modules */}
      <div 
        role="region" 
        aria-label="Module Track Mode Selector"
        className="bg-[#090d16] border-b border-slate-800/90 px-6 py-2.5"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-sky-400 uppercase tracking-wider">VIEW MODE:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setViewMode("member1")}
              className={`px-3.5 py-1.5 rounded text-xs font-mono font-bold transition flex items-center gap-2 border ${
                viewMode === "member1"
                  ? "bg-sky-500/20 text-sky-300 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                  : "bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              Core AI Dashboard (Member 1)
            </button>
            <button
              onClick={() => setViewMode("tripwire")}
              className={`px-3.5 py-1.5 rounded text-xs font-mono font-bold transition flex items-center gap-2 border ${
                viewMode === "tripwire"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                  : "bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Polygon Tripwire (Member 2)
            </button>
            <button
              onClick={() => setViewMode("multicam")}
              className={`px-3.5 py-1.5 rounded text-xs font-mono font-bold transition flex items-center gap-2 border ${
                viewMode === "multicam"
                  ? "bg-purple-500/20 text-purple-300 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                  : "bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-purple-400" />
              Multi-Cam Escalation (Member 2)
            </button>
            <button
              onClick={() => setViewMode("synopsis")}
              className={`px-3.5 py-1.5 rounded text-xs font-mono font-bold transition flex items-center gap-2 border ${
                viewMode === "synopsis"
                  ? "bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                  : "bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <Film className="w-3.5 h-3.5 text-amber-400" />
              Synopsis &amp; Dossier (Member 2)
            </button>
          </div>
        </div>
      </div>

      {/* Member 1: Core AI Dashboard (Default View) */}
      {viewMode === "member1" && (
        <>
          {/* Navigation Tabs Bar */}
          <nav 
            role="tablist" 
            aria-label="Forensic Command Center Sections" 
            className="border-b border-slate-800/80 bg-[#0d121f]"
          >
            <div className="max-w-7xl mx-auto px-6 flex space-x-1 overflow-x-auto">
              <button
                role="tab"
                aria-selected={activeTab === "ingestion"}
                aria-controls="tab-ingestion"
                onClick={() => setActiveTab("ingestion")}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap focus:ring-1 focus:ring-sky-500 focus:outline-none ${
                  activeTab === "ingestion"
                    ? "border-sky-500 text-sky-400 bg-sky-950/20 shadow-[inset_0_-2px_6px_rgba(56,189,248,0.2)]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                TAB 1: DVR INGESTION &amp; SIEVE TELEMETRY
              </button>

              <button
                role="tab"
                aria-selected={activeTab === "search"}
                aria-controls="tab-search"
                onClick={() => setActiveTab("search")}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap focus:ring-1 focus:ring-sky-500 focus:outline-none ${
                  activeTab === "search"
                    ? "border-sky-500 text-sky-400 bg-sky-950/20 shadow-[inset_0_-2px_6px_rgba(56,189,248,0.2)]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                TAB 2: MULTIMODAL CTRL+F SEARCH &amp; PLAYER
              </button>

              <button
                role="tab"
                aria-selected={activeTab === "spatial"}
                aria-controls="tab-spatial"
                onClick={() => setActiveTab("spatial")}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap focus:ring-1 focus:ring-sky-500 focus:outline-none ${
                  activeTab === "spatial"
                    ? "border-sky-500 text-sky-400 bg-sky-950/20 shadow-[inset_0_-2px_6px_rgba(56,189,248,0.2)]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                TAB 3: SPATIAL POLYGON TRIPWIRE &amp; ESCAPE MAP
              </button>

              <button
                role="tab"
                aria-selected={activeTab === "synopsis"}
                aria-controls="tab-synopsis"
                onClick={() => setActiveTab("synopsis")}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap focus:ring-1 focus:ring-sky-500 focus:outline-none ${
                  activeTab === "synopsis"
                    ? "border-sky-500 text-sky-400 bg-sky-950/20 shadow-[inset_0_-2px_6px_rgba(56,189,248,0.2)]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                TAB 4: 60s VIDEO SYNOPSIS &amp; SHA-256 DOSSIER
              </button>
            </div>
          </nav>

          {/* Main Forensic Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6" id={`tab-${activeTab}`}>
            {activeTab === "ingestion" && (
              <IngestionTelemetry onLoadDemoScenario={() => handleLoadJudgeDemo()} />
            )}

            {activeTab === "search" && (
              <SearchAndPlayer />
            )}

            {activeTab === "spatial" && (
              <div className="space-y-6">
                <PolygonTripwireCanvas />
                <MultiCamEscapeMap />
              </div>
            )}

            {activeTab === "synopsis" && (
              <SynopsisAndDossier />
            )}
          </main>
        </>
      )}

      {/* Member 2 Dedicated Module Views */}
      {viewMode === "tripwire" && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
          <PolygonTripwire />
        </main>
      )}

      {viewMode === "multicam" && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
          <MultiCamEscalation />
        </main>
      )}

      {viewMode === "synopsis" && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
          <ForensicSynopsisDossier />
        </main>
      )}

      {/* Forensic Footer */}
      <footer role="contentinfo" className="border-t border-slate-900 bg-[#070a12] py-4 px-6 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span>HAWKEYE (BOUNTYCAM) // ZERO-CLOUD AIR-GAPPED FORENSICS</span>
            <span className="hidden sm:inline text-slate-700">|</span>
            <span className="hidden sm:inline text-slate-600 flex items-center gap-1">
              <Keyboard className="w-3 h-3" /> Shortcuts: [Space] Play/Pause • [Ctrl+F] Search
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-sky-400">STAGES 1-3: 100% LOCAL GPU</span>
            <span>•</span>
            <span className="text-emerald-400">STAGE 4: GEMINI 2.5 FLASH</span>
            <span>•</span>
            <span className="text-slate-400">SHA-256 CERTIFIED</span>
          </div>
        </div>
      </footer>

      {/* Judge Demo Selector Modal */}
      {showDemoModal && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="demo-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0f172a] border border-amber-500/50 rounded-lg max-w-lg w-full p-6 space-y-4 font-mono text-xs shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div id="demo-modal-title" className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Zap className="w-4 h-4 fill-amber-400" />
                SELECT LIVE STAGE JUDGE DEMO SCENARIO
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="text-slate-400 hover:text-white text-base"
                aria-label="Close demo modal"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-300 leading-relaxed">
              Instantly activates pre-indexed forensic CCTV data across all 4 dashboard modules for smooth, zero-latency live judging presentation:
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => handleLoadJudgeDemo("Red Motorcycle Suspect Highway Escape")}
                className="w-full text-left p-3 rounded bg-[#111827] hover:bg-[#1e293b] border border-sky-500/40 hover:border-sky-400 transition"
              >
                <div className="font-bold text-sky-400 flex items-center justify-between">
                  <span>SCENARIO 1: HIGH-SPEED MOTORCYCLE ESCAPE</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">RECOMMENDED</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Suspect on red Pulsar with blue backpack crossing Gate @42km/h &rarr; Hostel Road &rarr; NH48 Highway merge. Shows Sieve, Re-ID, and speed estimation.
                </div>
              </button>

              <button
                onClick={() => handleLoadJudgeDemo("🌙 IR Night Vision Fence Intrusion")}
                className="w-full text-left p-3 rounded bg-[#111827] hover:bg-[#1e293b] border border-purple-500/40 hover:border-purple-400 transition"
              >
                <div className="font-bold text-purple-400">
                  SCENARIO 2: 🌙 IR NIGHT-VISION PERIMETER BREACH
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Intruder scaling north fence at 02:14 AM. Demonstrates Fix 4 Auto-IR saturation detector (Saturation &lt; 15.0) and shape-based classification.
                </div>
              </button>

              <button
                onClick={() => handleLoadJudgeDemo("Pedestrian Cargo Duffel Bag Tampering")}
                className="w-full text-left p-3 rounded bg-[#111827] hover:bg-[#1e293b] border border-slate-700 hover:border-slate-500 transition"
              >
                <div className="font-bold text-slate-200">
                  SCENARIO 3: PEDESTRIAN DUFFEL BAG TAMPERING
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Walking pedestrian crossing Gate with black duffel bag. Demonstrates 50x50px filter, 15% context padding, and Gemini Flash OCR audit.
                </div>
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowDemoModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
