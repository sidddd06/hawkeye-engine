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
  ExternalLink
} from "lucide-react";

import { IngestionTelemetry } from "@/components/member1_core/IngestionTelemetry";
import { SearchAndPlayer } from "@/components/member1_core/SearchAndPlayer";
import { PolygonTripwireCanvas } from "@/components/member2_spatial/PolygonTripwireCanvas";
import { MultiCamEscapeMap } from "@/components/member2_spatial/MultiCamEscapeMap";
import { SynopsisAndDossier } from "@/components/member2_spatial/SynopsisAndDossier";
import { HealthResponse } from "@/types/contract";

export default function ForensicCommandCenter() {
  const [activeTab, setActiveTab] = useState<"ingestion" | "search" | "spatial" | "synopsis">("search");
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
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLoadJudgeDemo = () => {
    setActiveTab("search");
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Tactical Top Forensic Header */}
      <header className="border-b border-slate-800/80 bg-[#0b0f19]/90 backdrop-blur sticky top-0 z-50 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-sky-500/10 border border-sky-400 flex items-center justify-center text-sky-400 font-bold shadow-[0_0_12px_rgba(56,189,248,0.3)]">
              🦅
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-wider font-mono text-slate-100 uppercase">
                  HAWKEYE // BOUNTYCAM
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
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
            {/* GPU Live Badge */}
            <div className="hidden sm:flex items-center gap-2 bg-[#111827] border border-slate-800 px-3 py-1.5 rounded font-mono text-xs">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">GPU:</span>
              <span className="text-sky-300 font-semibold">{health.gpu_device_name}</span>
            </div>

            {/* Stage 4 Gemini Badge */}
            <div className="hidden md:flex items-center gap-1.5 bg-[#111827] border border-slate-800 px-2.5 py-1.5 rounded font-mono text-[11px] text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
              <span>GEMINI 2.5 FLASH</span>
            </div>

            {/* 1-Click Judge Demo Button */}
            <button
              onClick={handleLoadJudgeDemo}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-mono font-bold text-xs rounded transition shadow-[0_0_15px_rgba(245,158,11,0.3)]"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              ⚡ LOAD JUDGE DEMO SCENARIO
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <nav className="border-b border-slate-800/80 bg-[#0d121f]">
        <div className="max-w-7xl mx-auto px-6 flex space-x-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab("ingestion")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === "ingestion"
                ? "border-sky-500 text-sky-400 bg-sky-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            TAB 1: DVR INGESTION &amp; SIEVE TELEMETRY
          </button>

          <button
            onClick={() => setActiveTab("search")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === "search"
                ? "border-sky-500 text-sky-400 bg-sky-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            TAB 2: MULTIMODAL CTRL+F SEARCH &amp; PLAYER
          </button>

          <button
            onClick={() => setActiveTab("spatial")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === "spatial"
                ? "border-sky-500 text-sky-400 bg-sky-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            TAB 3: SPATIAL POLYGON TRIPWIRE &amp; ESCAPE MAP
          </button>

          <button
            onClick={() => setActiveTab("synopsis")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === "synopsis"
                ? "border-sky-500 text-sky-400 bg-sky-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            TAB 4: 60s VIDEO SYNOPSIS &amp; SHA-256 DOSSIER
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
        {activeTab === "ingestion" && (
          <IngestionTelemetry onLoadDemoScenario={handleLoadJudgeDemo} />
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

      {/* Forensic Footer */}
      <footer className="border-t border-slate-900 bg-[#070a12] py-4 px-6 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div>HAWKEYE (BOUNTYCAM) // ZERO-CLOUD AIR-GAPPED FORENSICS</div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>STAGES 1-3: 100% LOCAL GPU</span>
            <span>•</span>
            <span>STAGE 4: GEMINI 2.5 FLASH AUDIT</span>
            <span>•</span>
            <span>CONTRACT LOCKED: CONTRACTS.md</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
