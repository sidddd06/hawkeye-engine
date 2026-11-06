@echo off
TITLE HawkEye / BountyCam - Forensic Command Center Launcher
COLOR 0B

echo =========================================================================
echo   HAWKEYE // BOUNTYCAM - ZERO-CLOUD CCTV FORENSICS LAUNCHER
echo   NVIDIA RTX 4070 / RTX 3050 Local-First Architecture
echo =========================================================================
echo.

echo [1/2] Starting HawkEye FastAPI Backend Service on Port 8000...
start "HawkEye-Backend" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting HawkEye Next.js Frontend Command Center on Port 3000...
start "HawkEye-Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo =========================================================================
echo   HAWKEYE SYSTEM INITIALIZED!
echo   - Backend API: http://localhost:8000/docs
echo   - Frontend UI: http://localhost:3000
echo =========================================================================
echo.
