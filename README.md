# 🛸 AeroMesh: AI-Powered 3D Drone Reconstruction

<div align="center">

![AeroMesh Banner](https://img.shields.io/badge/SIH_2026-PSC26158-orange?style=for-the-badge)
![NTRO Sponsored](https://img.shields.io/badge/Sponsored_by-NTRO-0052cc?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-MVP_Complete-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**"One Flight. One Video. One Complete 3D World."**

[Features](#-core-features) • [Installation](#-installation--quickstart) • [Architecture](#-system-architecture) • [Task List](task_list.md)

</div>

---

AeroMesh is an advanced AI-powered 3D reconstruction platform built specifically for crisis management and tactical reconnaissance. It converts a **single-pass drone video** into a fully navigable, georeferenced, metrically accurate 3D point cloud and mesh—in under 10 minutes—delivered directly in your browser.

## 🔴 The Problem: "One Shot. No Second Chance."

Drones are routinely sent into active disaster zones (NDRF), military reconnaissance missions (NTRO), and critical infrastructure inspections. However, standard drone cameras produce flat 2D video. To turn that into a 3D model today using standard photogrammetry (Pix4D, Metashape), you need:

- 3–5 structured, overlapping flight passes (You only had one chance to fly).
- 80% image overlap (Single-pass video has less than 10% effective stereo overlap).
- Physical Ground Control Points (GCPs) (The ground is inaccessible or hostile).
- 2–10 hours of heavy post-processing (Agencies need intelligence in minutes).

---

## 💚 The Solution: AeroMesh

**We eliminate the need for flight planning, multiple passes, and desktop software.** 

**One video in → Complete 3D world out.**

| Feature | **Before AeroMesh** | **With AeroMesh** |
|---|---|---|
| **Flights needed** | 3–5 multi-pass missions | 1 single manual pass |
| **Processing time** | 2–10 hours | **Under 10 minutes** |
| **Software cost** | ₹5–50 lakh/year | **Open-source & Accessible** |
| **Output type** | Flat orthomosaic image | **Walkable dense 3D point cloud** |
| **Measurable scale?** | Only with ground GCPs | **Yes — GPS-fused automatically** |

---

## 📸 Core Features in Action

- **Blender-Style Browser 3D IDE**: Walk through the reconstruction in first-person (WASD), measure distances with interactive raycasting, and toggle confidence heatmaps without installing any desktop software.
- **Metric Measurement**: Click any two points in the 3D viewer; the system calculates exact real-world distance in meters using Sim(3) GPS anchoring.
- **Dynamic Object Masking**: Automatically detects and masks out moving vehicles and people using optical flow and SAM 2, preventing "ghost" 3D artifacts.
- **Video ↔ 3D Sync**: Scrubbing the video timeline automatically moves the 3D camera to the exact drone position in the reconstructed world.

*(Note: Add UI/UX screenshots here prior to final submission)*

---

## ⭐ Five Core Mathematical Innovations

1. **Multi-Stride Frame Matching**: Matches features across frames at strides of (i+1), (i+2), and (i+4) simultaneously, artificially widening the stereo baseline and fixing the geometric collapse typical of single-pass footage.
2. **MiDaS Dense Neural Back-Projection**: Runs MiDaS v2.1 depth estimation on every frame, back-projecting every pixel into global 3D space to generate 2–10 million real colored points.
3. **Sim(3) 7-DoF GPS Metric Anchoring**: Fuses GPS telemetry via CubicSpline interpolation and computes a Kabsch-Umeyama SVD rigid transform to anchor the point cloud to absolute real-world meters.
4. **DJI SRT Midpoint Timestamp Interpolation**: Extracts the exact midpoint of SRT subtitle timecodes to perfectly synchronize 1Hz GPS logs with sub-second video frames.
5. **GPU Queue Management**: Asynchronous task manager with serial GPU locking ensures the AI models don't overflow VRAM on smaller deployment hardware.

---

## 🏗️ System Architecture

```text
User Input (Video + Telemetry) 
  │
  ├─► Ingestion & Preprocessing (Blur Filter, 4K Downscaler, SRT Parser)
  │
  ├─► Dynamic Object Masking (Motion Diff / YOLO removes ghosts)
  │
  ├─► 3D Reconstruction Engine (SIFT+FLANN Multi-Stride, MiDaS Neural Depth)
  │
  ├─► Georeferencing & Alignment (CubicSpline, SVD Rigid Transform)
  │
  ├─► Surface Meshing & Export (Poisson, PLY/OBJ/GeoJSON)
  │
  └─► Web Viewer & Analytics (Three.js Walk Mode, NTRO Accuracy Audit)
```

---

## ⚡ Installation & Quickstart

### Prerequisites
- Node.js v18+
- Python 3.10+
- FFmpeg (for video extraction)
- CUDA Toolkit (optional, for GPU acceleration)

### 1. Start the Frontend (React + Three.js)
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173`

### 2. Start the Backend (FastAPI + PyTorch)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

### 3. Run a CLI Pipeline Test
```bash
cd backend
python scripts/process_flight.py \
  --video samples/flight_01.mp4 \
  --telemetry samples/telemetry_01.srt \
  --output ./output \
  --model demo
```

---

## 📂 Project Structure

```
AeroMesh/
├── backend/
│   ├── app.py                     # FastAPI server and job queue
│   ├── pipeline/
│   │   ├── ingest.py              # Frame extraction & blur filtering
│   │   ├── telemetry.py           # GPS parsing & SVD metric alignment
│   │   ├── meshing.py             # Point cloud to OBJ/PLY export
│   │   └── engines/               # Pluggable reconstruction engines
│   │       ├── base.py            # Abstract Base Class
│   │       ├── demo.py            # CPU-friendly synthetic fallback
│   │       └── vggsfm.py          # GPU Feed-forward vision transformer
│   └── scripts/
│       └── process_flight.py      # Standalone CLI runner
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Viewer3D.jsx       # Core Three.js rendering engine
│   │   │   ├── VideoPane.jsx      # Synchronized video playback
│   │   │   └── QualityBadge.jsx   # NTRO Audit readouts
│   │   └── App.jsx
│   └── package.json
├── docs/                          # Comprehensive mathematical documentation
└── task_list.md                   # Project master task tracker
```

---

## 🤝 Contributing & Master Tasks
We are actively working through the final feature checklist. See [task_list.md](task_list.md) for the active roadmap.

## 📝 License
Built for Smart India Hackathon (SIH) 2026. Sponsored by NTRO. MIT Licensed.
