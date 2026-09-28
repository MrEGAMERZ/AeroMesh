# 🛸 AeroMesh

**SIH 2026 | Problem Statement PSC26158 | Sponsored by NTRO**

> **"One Flight. One Video. One Complete 3D World."**

AeroMesh is an AI-powered 3D reconstruction platform that converts a single-pass drone video into a fully navigable, georeferenced, metrically accurate 3D model — in under 10 minutes — delivered directly in your browser.

---

## 🔴 The Problem: "One Shot. No Second Chance."

Every day, drones are sent into active disaster zones, military reconnaissance missions, and critical infrastructure inspections. 

**What happens after the drone comes back?**
The footage is flat. It's a 2D video. You can *watch* what the drone saw — but you can't *measure* it, *walk through* it, or *plan around* it.

To turn that into a 3D model today, you need:
- 3–5 structured flight passes (You only had one chance to fly)
- 75–85% image overlap (Single-pass video has 5–10% effective stereo overlap)
- Ground Control Points (GCPs) set on the ground (The ground is inaccessible)
- Expensive Software like Pix4D / Metashape (Inaccessible to field teams)
- 2–10 hours of post-processing (NTRO needs intelligence in minutes)

---

## 💚 The Solution: AeroMesh

**We asked a simple question:**
> *"What if AI could look at a single drone video — no flight planning, no overlap, no GCPs — and reconstruct the entire 3D world from it? Accurate. Measurable. In minutes."*

**One video in → Complete 3D world out.**

| Feature | **Before AeroMesh** | **With AeroMesh** |
|---|---|---|
| **Flights needed** | 3–5 multi-pass missions | 1 single pass |
| **Processing time** | 2–10 hours | Under 10 minutes |
| **Software cost** | ₹5–50 lakh/year | Open + accessible |
| **Expert operator required?** | Yes | No — upload and go |
| **Output type** | Flat orthomosaic image | Walkable 3D point cloud |
| **Measurable in real meters?** | Only with GCPs | Yes — GPS-fused automatically |
| **Works in crisis conditions?** | ❌ No | ✅ Yes |

---

## ⭐ Five Core Innovations

1. **Multi-Stride Frame Matching**: Matches frames at strides (i+1), (i+2), and (i+4) simultaneously to artificially expand the effective stereo baseline, fixing COLMAP's single-pass collapse.
2. **MiDaS Dense Neural Back-Projection**: Runs neural depth (MiDaS v2.1) on every frame and back-projects every pixel into 3D global coordinates. Result: 2–10 million real colored 3D points.
3. **Sim(3) 7-DoF GPS Metric Anchoring**: Fuses GPS telemetry using CubicSpline interpolation and computes an SVD rigid transform to anchor the point cloud to real-world meters.
4. **DJI SRT Midpoint Timestamp Interpolation**: Extracts the exact midpoint of SRT subtitle timecodes to perfectly align 1Hz GPS data with sub-second video frames.
5. **Blender-Style Browser-Native 3D IDE**: Walk through the reconstruction, click to measure distances, and export to CAD without installing any desktop software.

---

## 🏗️ System Architecture

```text
User Input (Video + Telemetry) 
  ↓
Ingestion & Preprocessing (Blur Filter, Downscaler, SRT Parser)
  ↓
Dynamic Object Masking (Motion Diff / YOLO - removes ghosts)
  ↓
3D Reconstruction Engine (SIFT+FLANN Multi-Stride, MiDaS Dense Back-Projection)
  ↓
Georeferencing & Alignment (CubicSpline, SVD Rigid Transform)
  ↓
Surface Meshing & Export (Poisson, PLY/OBJ)
  ↓
Web Viewer & Analytics (Three.js Walk Mode, Measurement Tool, NTRO Audit)
```

---

## ⚡ Quickstart

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```
Run pipeline:
```bash
python scripts/process_flight.py --video path/to/video.mp4 --telemetry path/to/telemetry.srt --output ./output --model demo
```

---

## 📝 License
Built for SIH 2026.
