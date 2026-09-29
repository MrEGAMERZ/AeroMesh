# 📋 AeroMesh Master Task List

This document tracks the remaining tasks to move AeroMesh from a high-functioning MVP to a production-ready deployment for the SIH 2026 finals.

## 🚀 Priority 1: Core 3D Interactive Features
- [x] **Interactive Metric Measurement Tool**: Implement Three.js Raycaster in `Viewer3D.jsx`. Allow users to click point A and point B on the point cloud, draw a line, and calculate the absolute distance in meters (using the Sim3 scaled coordinates).
- [x] **Video ↔ 3D Synchronization**: Connect the HTML5 video playback slider in `VideoPane.jsx` to the camera position in the 3D viewer. As the video plays, the 3D camera should automatically move along the solved flight trajectory.
- [ ] **Confidence Heatmap Overlay**: Add a toggle in the UI to color the point cloud based on geometric confidence (Blue = High, Yellow = Medium, Red = Low).

## 🧠 Priority 2: AI Engine Upgrades
- [x] **VGGSfM GPU Pipeline Integration**: Complete the `vggsfm.py` engine adapter. Ensure it correctly loads the PyTorch weights into VRAM, processes the frames, and returns a dense depth map, fully replacing the `DemoEngine` mock when GPU hardware is present.
- [ ] **Semantic Segmentation Layer (SAM 2)**: Integrate Segment Anything 2 into the pipeline. After frame extraction, run SAM 2 to classify pixels into classes (Building, Road, Vegetation, Vehicle).
- [ ] **Dynamic Object Masking**: Use the SAM 2 output + optical flow to permanently delete moving objects (cars, pedestrians) from the final point cloud to prevent floating artifacts.

## 📐 Priority 3: Metric Accuracy Validation
- [ ] **Benchmarking Suite**: Download the UrbanScene3D or SensatUrban dataset (which includes LiDAR ground truth).
- [ ] **Sim(3) 7-DoF Validation**: Run the AeroMesh pipeline on the dataset and compute the RMSE (Root Mean Square Error) between our GPS-anchored point cloud and the LiDAR ground truth. Ensure error is < 1.0 meters.
- [ ] **NTRO Quality Report Generator**: Finalize the `quality_report.py` output to include calculated GSD (Ground Sampling Distance) and trajectory RMSE in a structured JSON format.

## 🛠 Priority 4: Deployment & DevOps
- [ ] **Dockerization**: Create a `docker-compose.yml` that spins up the FastAPI backend, the React frontend, and a Redis queue with one command.
- [ ] **Offline Mode Validation**: Ensure the entire pipeline (including MiDaS ONNX weights) can run completely disconnected from the internet (critical requirement for military/NTRO deployment).
- [ ] **Clean Codebase**: Remove all files in `archive_to_delete/` and legacy patching scripts.

---
*Last Updated: 2026-09-29*
