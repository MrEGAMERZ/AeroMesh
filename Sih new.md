# SIH26158 — Single-Pass Drone Video → 3D Model
Research notes (Sept 2026)

## 1. Problem recap
- Input: one drone flight pass (video), GPS, flight metadata (mandatory); IMU, barometric alt, camera intrinsics, RTK/PPK (optional)
- Output: georeferenced, metrically-accurate textured mesh/point cloud
- Hard constraints: no multi-pass reprocessing, minimal GCPs, near real-time, handle motion blur/dynamic objects/occlusion

## 2. Core approach shift: skip classic SfM, use feed-forward 3D transformers
Classic COLMAP-style SfM + MVS is too slow for "near real-time" and struggles with single-pass sparse-angle coverage. 2025-2026 research has moved to **feed-forward 3D reconstruction transformers** that take video frames and directly regress geometry in one forward pass — no bundle adjustment, no per-scene optimization. This is the right fit for this PS.

### Recommended model stack (in order of relevance)

**MapAnything (Meta + CMU, 2025)** — the strongest fit
- Unified feed-forward transformer: ingests images + *optional* intrinsics/poses/depth, directly regresses **metric-scale** 3D geometry + camera poses in one pass
- Directly attacks the PS's hardest challenge ("metric accuracy without extensive GCPs") — it fuses depth maps, ray maps, camera poses, and a learned metric scale factor
- Feed drone GPS/altitude/intrinsics as the "optional" inputs to anchor scale → this is your accuracy differentiator
- github: facebookresearch/map-anything, project page: map-anything.github.io

**VGGT / VGGSfM (Oxford VGG + Meta, CVPR 2025 Best Paper / CVPR 2026 oral)**
- Feed-forward transformer: one forward pass over 1–100s of frames → cameras, depth maps, point maps, 3D point tracks, globally consistent
- Matches/beats COLMAP on benchmarks at a fraction of the time; VGGSfM adds dynamic scene support (handles moving vehicles/people) and runs in ~30% of VGGT's memory
- Good as your core "single-pass video → point cloud" engine; pair with MapAnything for metric scale, or use VGGSfM alone if MapAnything integration proves complex
- On an H200 this can likely run near-real-time on 4K drone footage

**Alternative/backup: DUSt3R / MASt3R**
- Earlier generation (pairwise, needs global alignment post-process) — slower, more mature tooling/community support. Use as fallback if VGGT/MapAnything setup is unstable during hackathon crunch.

### Dynamic object handling
- **SAM2** (Meta) for video segmentation — mask out vehicles/humans/animals per-frame before/during reconstruction so they don't corrupt the static scene geometry
- Feed-forward models like VGGSfM natively tolerate some dynamics, but masking is still recommended for clean output

### Metric depth cross-check / fallback
- **Metric3D v2** or **Depth Pro** (Apple) — zero-shot monocular metric depth, useful as a secondary signal to sanity-check/refine scale estimates from MapAnything, or as a fallback depth source per-frame
- Depth Anything V2 — best relative depth quality, but not metric; use only if you add your own scale calibration (e.g., via known altitude)

### Texturing & mesh extraction
- Point cloud/point map output from VGGT/MapAnything → Poisson surface reconstruction or Open3D meshing → project frame textures back onto mesh (standard photogrammetry-style UV texturing)
- If judges want photorealism over precise meshes: 3D Gaussian Splatting (gsplat / nerfstudio) trains in minutes on H200s and gives a renderable model, but mesh/measurement extraction from splats is still less reliable than a true mesh — mention this as a known limitation

### GPS/IMU fusion for georeferencing
- Use GPS track + altitude + (if available) IMU to rigidly transform the reconstructed local point cloud into world/geo coordinates
- This is classic sensor fusion (Kalman filter or simple least-squares alignment of camera trajectory to GPS log), not a deep learning problem — keep it simple and robust

## 3. Proposed pipeline (H200-enabled)
1. Ingest video → extract frames (adaptive sampling, drop redundant/blurry frames via blur-detection)
2. SAM2 → mask dynamic objects across frames
3. MapAnything (or VGGSfM) → feed-forward metric point cloud + camera poses, using GPS/intrinsics as optional inputs
4. Fuse GPS/IMU trajectory with estimated camera poses → georeference the model, correct scale drift
5. Mesh: Poisson reconstruction (Open3D) on the point cloud → clean/smooth → UV texture from source frames
6. Output: georeferenced OBJ/GLTF + point cloud (LAS/PLY) + web viewer (Three.js/CesiumJS) with basic measurement tools

## 4. Hardware/software requirements
- **Compute**: H200 cluster (confirmed available) — needed for VGGT/MapAnything inference at 4K, SAM2 video segmentation, and any Gaussian Splatting training
- **Frameworks**: PyTorch, Open3D, OpenCV, COLMAP (optional fallback/refinement), gsplat or nerfstudio (if doing splatting), CesiumJS or Three.js for georeferenced viewer
- **Models to pull from GitHub/HuggingFace**: MapAnything, VGGSfM (check license/availability — VGGSfM may only have paper+partial code at time of hackathon; VGGT v1 is open), SAM2, Metric3D v2/Depth Pro as backup
- **Data**: need real or simulated drone video with GPS/flight logs for testing (DJI sample datasets, or your own test flight if you have drone access)

## 5. Key risks / honesty notes for the team
- VGGSfM is very new (CVPR 2026) — code availability may be partial; have VGGT v1 or MapAnything as the safe primary choice
- "Metric accuracy without GCPs" — realistically you'll get GPS-grade accuracy (few meters), not survey-grade (cm). Position this honestly to judges as "rapid situational awareness," not survey-grade mapping
- Occluded surfaces (backs of buildings, undersides) genuinely cannot be reconstructed from single-pass footage — don't hide this, mention it as a stated limitation with a possible inpainting/symmetry-completion stretch goal
- Real-time claim: full pipeline likely near-real-time (minutes) on H200, not literally live — be precise about this distinction in your pitch
