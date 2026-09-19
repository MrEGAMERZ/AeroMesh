# SIH26158 --- Single-Pass Drone Video to Accurate 3D Model Generation

## Master Research, Product, Architecture & Hackathon Execution Roadmap

**Project working name:** AeroMesh\
**Problem Statement:** SIH26158\
**Organization:** National Technical Research Organisation (NTRO)\
**Theme:** Robotics and Drones\
**Category:** Software\
**Document type:** Research + Product Requirements + Technical Roadmap +
Validation Plan\
**Research snapshot:** September 2026

------------------------------------------------------------------------

# 0. Executive Summary

## The problem in one sentence

Build a system that takes **one drone flight's video + available flight
telemetry** and produces a **georeferenced, metrically useful 3D
representation** of the captured scene quickly enough for operational
use.

## What we are NOT building

We are not building:

-   a generic 3D editor;
-   a generic Blender clone;
-   a generic drone mapping dashboard;
-   a "pretty 3D demo" with no measurement evidence;
-   a new 3D foundation model from scratch;
-   a system that pretends to know hidden geometry with certainty.

## What we ARE building

A **single-pass aerial reconstruction pipeline** that combines:

1.  intelligent video/frame selection;
2.  learned and/or classical 3D geometry estimation;
3.  camera trajectory estimation;
4.  GPS/IMU/altitude-aware metric alignment;
5.  dynamic-object suppression;
6.  point-cloud fusion;
7.  mesh + texture generation;
8.  georeferencing;
9.  reconstruction confidence / quality reporting;
10. a lightweight 3D viewer with measurement and export.

## Core product promise

> **Fly once. Reconstruct fast. Measure in meters. Know what is measured
> and what is inferred.**

The exact quantitative claims must be established experimentally on the
supplied/benchmark data. Do not put unverified speed or accuracy numbers
into the final PPT.

------------------------------------------------------------------------

# 1. Official Problem Statement --- What NTRO Actually Asked For

The official PS requires an AI-enabled system that can generate a
**georeferenced and metrically accurate 3D model** from a **single-pass
drone video stream** captured while the UAV is moving.

### Mandatory inputs

-   1080p/4K drone video
-   GPS coordinates
-   flight metadata

### Optional inputs

-   IMU data
-   barometric altitude
-   camera intrinsic parameters
-   RTK/PPK corrections

### Expected reconstructed scene elements

-   terrain and structures
-   building facades
-   rooftops
-   roads and infrastructure
-   vegetation
-   obstacles
-   textured 3D meshes or point clouds

### Expected usefulness

The result should support:

-   visualization
-   measurement
-   analysis

### Explicit challenges in the PS

1.  Limited viewing angles from a single flight path
2.  Motion blur and video compression
3.  Variable illumination and shadows
4.  Dynamic objects such as vehicles, humans and animals
5.  GPS inaccuracies and sensor noise
6.  Real-time or near-real-time processing
7.  Occluded surfaces
8.  Metric accuracy without extensive Ground Control Points

### Critical interpretation

The PS is fundamentally a **geometry + sensor fusion + systems
engineering** problem.

The 3D viewer is the final interface. It is not the core innovation.

------------------------------------------------------------------------

# 2. What the Existing Industry Already Does

Before claiming novelty, understand the baseline.

## 2.1 Traditional photogrammetry

A conventional aerial reconstruction pipeline generally looks like:

``` text
Images / video frames
        ↓
Feature extraction
        ↓
Feature matching
        ↓
Structure-from-Motion
        ↓
Camera pose estimation
        ↓
Bundle adjustment
        ↓
Multi-View Stereo
        ↓
Dense point cloud
        ↓
Surface reconstruction
        ↓
Texture mapping
        ↓
Georeferencing / GIS outputs
```

COLMAP explicitly implements Structure-from-Motion and Multi-View
Stereo. Its documentation describes SfM as recovering camera poses and
sparse 3D structure, followed by MVS for dense depth/point-cloud
reconstruction and mesh generation.

Source: https://colmap.github.io/

## 2.2 Why conventional photogrammetry works well

It benefits from:

-   high image overlap;
-   multiple viewpoints;
-   textured surfaces;
-   stable camera calibration;
-   controlled capture;
-   sufficient baseline between views;
-   good GPS/GCP information.

COLMAP's own capture guidance recommends high visual overlap, different
viewpoints and at least several observations of scene objects; it also
recommends downsampling video input because more frames are not
necessarily better.

## 2.3 Commercial drone mapping

Commercial platforms already provide substantial capabilities.

### PIX4D

PIX4Dmapper supports:

-   photogrammetry;
-   point clouds;
-   3D textured meshes;
-   DSM/DTM;
-   orthomosaics;
-   measurements;
-   quality reports;
-   GPS/GCP-based workflows.

PIX4D documentation describes typical 3D mapping workflows as relying on
aerial imagery with high overlap and lists 3D mesh and point-cloud
generation as standard outputs.

Source:
https://www.pix4d.com/product/pix4dmapper-photogrammetry-software

### Agisoft Metashape

Metashape is a mature photogrammetric platform for converting digital
imagery into 3D spatial data used in GIS, cultural heritage, inspection
and measurement workflows.

Source: https://www.agisoft.com/

### OpenDroneMap

OpenDroneMap is an open-source aerial imagery processing toolkit. It
produces:

-   georeferenced point clouds;
-   textured 3D models;
-   DSM/DTM;
-   orthophotos;
-   classified point clouds.

Source: https://opendronemap.org/odm/

------------------------------------------------------------------------

# 3. The Gap Created by SIH26158

The PS deliberately removes many assumptions that make traditional
photogrammetry comfortable.

Traditional workflow:

``` text
Good flight planning
       +
Many viewpoints
       +
High overlap
       +
Controlled capture
       +
Long processing
       +
Optional GCPs
       ↓
Accurate reconstruction
```

SIH scenario:

``` text
ONE PASS
   +
Limited viewpoints
   +
Video artifacts
   +
Moving objects
   +
GPS noise
   +
Possible occlusions
   +
Little/no GCPs
   +
Fast output
   ↓
Reliable metric reconstruction
```

### This is the actual research/engineering gap.

The opportunity is NOT:

> "3D reconstruction exists, therefore we make 3D reconstruction."

The opportunity is:

> **Adapt modern 3D vision + navigation data + robust preprocessing
> specifically for constrained single-pass aerial capture.**

------------------------------------------------------------------------

# 4. Modern AI-Based Reconstruction Landscape

Modern learned 3D systems change the design space.

## 4.1 VGGSfM

VGGSfM is a learned, geometry-grounded Structure-from-Motion system. Its
public implementation includes sequential/video input, dense point-cloud
export and support for filtering moving objects with masks.

Source: https://github.com/facebookresearch/vggsfm

Potential use in our project:

-   camera pose estimation;
-   sequential reconstruction;
-   fallback when classical SfM is fragile;
-   dynamic-scene experiments.

## 4.2 VGGT

VGGT is a feed-forward transformer for visual geometry. The official
implementation reports inference of camera extrinsics/intrinsics, point
maps, depth maps and point tracks from one, a few, or hundreds of views.

Source: https://github.com/facebookresearch/vggt

Potential use:

-   fast geometry prior;
-   camera/depth/point-map estimation;
-   baseline for learned reconstruction.

## 4.3 DUSt3R

DUSt3R is a geometric 3D vision framework that predicts 3D information
from image pairs/sequences and provides foundations for later
metric/global alignment methods.

Source: https://github.com/naver/dust3r

Potential use:

-   alternative geometry engine;
-   difficult viewpoint configurations;
-   comparison benchmark.

## 4.4 MapAnything

MapAnything is an open-source framework for universal feed-forward
metric 3D reconstruction. Its architecture supports different inputs
including images, calibration, poses and depth and exposes a unified
interface for several reconstruction models.

Source: https://github.com/facebookresearch/map-anything

Potential use:

-   primary learned reconstruction candidate;
-   metric geometry experiments;
-   common abstraction layer for model comparison.

## Important decision

Do NOT decide in advance that one model is "the solution."

Benchmark:

``` text
Same flight
   ├── COLMAP / classical
   ├── VGGSfM
   ├── VGGT
   ├── DUSt3R / compatible pipeline
   └── MapAnything
           ↓
Compare:
accuracy
completeness
speed
robustness
GPU memory
failure rate
```

The winning backend for the prototype should be selected from evidence.

------------------------------------------------------------------------

# 5. Our Team Repository --- AeroMesh

The current team repository already contains a useful architecture
direction.

Repository: https://github.com/MrEGAMERZ/AeroMesh

The current repository describes:

-   video ingestion;
-   blur filtering;
-   GPS/IMU telemetry parsing;
-   dynamic-object masking;
-   feed-forward reconstruction;
-   SVD/Kabsch-style alignment;
-   Poisson meshing;
-   WebGL/Three.js viewer;
-   measurement tools;
-   exports;
-   FastAPI backend.

The current repository structure includes backend modules for ingestion,
telemetry, dynamic masking, reconstruction and meshing, plus a
React/Three.js frontend.

### What is good in the current repo

Keep the conceptual separation:

``` text
backend/
  ingestion
  telemetry
  masking
  reconstruction
  meshing

frontend/
  viewer
  flight map
  measurement
  pipeline status
```

This is a good modular foundation.

### What needs to change

The current repo is too ambitious in places that do not directly improve
the PS score.

Examples of features that should NOT be core MVP:

-   Blender-style editing;
-   sculpting;
-   physics simulation;
-   complex material editing;
-   large CAD primitive libraries;
-   studio rendering;
-   elaborate lighting controls.

Those are product extensions.

The PS's core value is:

> **accurate + complete + fast single-pass reconstruction.**

------------------------------------------------------------------------

# 6. AeroMesh --- Reposition the Product

## Current conceptual positioning

"Fast AI 3D modelling platform."

## Recommended positioning

> **A single-pass aerial reconstruction and metric validation engine for
> turning constrained drone video + flight telemetry into georeferenced
> 3D scene data.**

### Product slogan

> **Fly Once. Reconstruct Fast. Measure in Meters.**

### Technical one-liner

> A navigation-aware reconstruction pipeline that combines learned
> visual geometry, flight telemetry, robust frame selection and
> dynamic-object suppression to produce georeferenced 3D point clouds
> and textured meshes with measurable quality indicators.

------------------------------------------------------------------------

# 7. Core Problem Decomposition

Break the entire PS into ten engineering problems.

  -----------------------------------------------------------------------
  Problem                             What we must solve
  ----------------------------------- -----------------------------------
  Video                               Convert long video into useful
                                      visual evidence

  Blur/compression                    Reject low-quality frames

  Sparse viewpoints                   Extract maximum geometry from
                                      limited baseline

  Camera motion                       Estimate a stable camera trajectory

  Depth                               Recover scene geometry

  Telemetry                           Synchronize video and flight data

  Metric scale                        Convert relative/learned geometry
                                      into real-world units

  Dynamic objects                     Prevent moving objects
                                      contaminating static geometry

  Occlusion                           Distinguish observed vs inferred
                                      geometry

  Output                              Produce usable, measurable,
                                      exportable 3D data
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 8. The Core Product Architecture

``` text
                         ┌──────────────────────┐
                         │      DRONE VIDEO     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ INGESTION & QC       │
                         │ decode / timestamps  │
                         │ blur / exposure      │
                         │ keyframe selection  │
                         └──────────┬───────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
             VISUAL EVIDENCE                 TELEMETRY
             frames / masks                  GPS / IMU
                     │                        altitude
                     │                        intrinsics
                     │                             │
                     └──────────────┬──────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │ CAMERA / GEOMETRY    │
                         │ RECONSTRUCTION       │
                         │ learned + classical  │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ SENSOR FUSION &      │
                         │ METRIC ALIGNMENT     │
                         │ scale / rotation /   │
                         │ translation / drift  │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ ROBUST FUSION        │
                         │ dynamic suppression  │
                         │ confidence weighting │
                         │ outlier rejection    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ POINT CLOUD          │
                         │ georeferenced        │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ SURFACE / MESH       │
                         │ reconstruction       │
                         │ texture projection   │
                         └──────────┬───────────┘
                                    │
                      ┌─────────────┼─────────────┐
                      ▼             ▼             ▼
                   3D VIEW       METRICS      EXPORT
                   mesh/points   QA/report    GLB/OBJ/PLY
                      │             │             │
                      └─────────────┼─────────────┘
                                    ▼
                         OPERATIONAL 3D OUTPUT
```

------------------------------------------------------------------------

# 9. Core Module 1 --- Ingestion and Frame Intelligence

## Goal

Turn a 1080p/4K video into a compact, high-quality reconstruction
sequence.

## Pipeline

``` text
Video
 ↓
Decode
 ↓
Timestamp extraction
 ↓
Telemetry synchronization
 ↓
Candidate sampling
 ↓
Blur score
 ↓
Exposure / saturation check
 ↓
Visual redundancy check
 ↓
Keyframe selection
```

## Baseline

Start with:

-   configurable sampling FPS;
-   Laplacian-variance blur score;
-   image-quality threshold;
-   temporal redundancy filtering.

Then improve toward adaptive sampling based on:

-   camera speed;
-   scene change;
-   feature density;
-   viewpoint change.

## Output

``` json
{
  "frame_id": 142,
  "timestamp": 71.0,
  "quality_score": 0.88,
  "blur_score": 412.4,
  "gps": "...",
  "altitude": 91.4
}
```

------------------------------------------------------------------------

# 10. Core Module 2 --- Telemetry Synchronization

## Inputs

-   GPS;
-   timestamp;
-   altitude;
-   yaw/pitch/roll if available;
-   IMU if available;
-   camera intrinsics if available;
-   RTK/PPK if available.

## Critical problem

The video frame timestamp and telemetry timestamp may not be perfectly
synchronized.

Therefore implement:

``` text
video timestamp
      ↕
interpolation / nearest-neighbor
      ↕
telemetry timestamp
```

## Required output

Every selected frame should have the best available navigation state:

``` text
Frame
 ├── timestamp
 ├── latitude
 ├── longitude
 ├── altitude
 ├── yaw
 ├── pitch
 ├── roll
 └── telemetry confidence
```

------------------------------------------------------------------------

# 11. Core Module 3 --- Dynamic Object Suppression

The PS explicitly calls out:

-   vehicles;
-   humans;
-   animals.

## Baseline

Use:

-   semantic/instance segmentation;
-   temporal motion cues;
-   optical flow;
-   track consistency.

Conceptually:

``` text
Frame t
Frame t+1
Frame t+2
   ↓
Object candidates
   +
Temporal motion
   ↓
Dynamic confidence
   ↓
Mask / down-weight
```

## Important principle

Do not blindly delete every detected person/car.

A parked car may be static scene geometry.

The mask should represent **probability of dynamic contamination**, not
merely object class.

------------------------------------------------------------------------

# 12. Core Module 4 --- 3D Reconstruction Engine

This is the heart of the project.

## Candidate A --- Classical

COLMAP / PyCOLMAP:

``` text
frames
 ↓
features
 ↓
matches
 ↓
SfM
 ↓
camera poses
 ↓
MVS
 ↓
dense cloud
```

Strengths:

-   mature;
-   interpretable;
-   proven;
-   strong baseline.

Weaknesses:

-   can be computationally expensive;
-   constrained viewpoint geometry can fail;
-   depends on useful image overlap/features.

## Candidate B --- Learned

VGGT / VGGSfM / MapAnything / DUSt3R family.

Strengths:

-   fast feed-forward inference;
-   learned geometry priors;
-   can handle difficult image relationships;
-   potentially better suited to sparse/limited-view scenarios.

Weaknesses:

-   GPU requirements;
-   model/domain mismatch;
-   metric accuracy still needs validation;
-   hallucination/inference risk on unobserved geometry.

## Recommended strategy

Build a **pluggable reconstruction interface**:

``` python
class ReconstructionBackend:
    def reconstruct(frames, intrinsics=None):
        return ReconstructionResult(
            camera_poses=...,
            point_maps=...,
            depth_maps=...,
            confidence=...
        )
```

Then implement adapters:

``` text
backends/
  colmap.py
  vggsfm.py
  vggt.py
  mapanything.py
```

Do not hard-wire the entire system to one research model.

------------------------------------------------------------------------

# 13. Core Module 5 --- Metric and Geographic Alignment

This is the most important engineering module after reconstruction.

## The problem

Visual reconstruction may have:

-   arbitrary origin;
-   arbitrary orientation;
-   arbitrary scale;
-   trajectory drift.

Telemetry gives an external reference.

## Baseline

Estimate:

``` text
visual camera trajectory
        +
GPS/IMU trajectory
        ↓
robust alignment
        ↓
scale + rotation + translation
```

A Kabsch/Umeyama-style similarity transform is a reasonable baseline.

## But do not claim

> "SVD alignment guarantees 1 m accuracy."

It does not.

The final accuracy depends on:

-   visual geometry quality;
-   telemetry quality;
-   time synchronization;
-   camera-to-GPS lever arm;
-   coordinate transformations;
-   flight dynamics;
-   model errors.

## Better design

Use robust weighted alignment:

``` text
high-quality RTK point       → high weight
normal GPS                   → medium weight
interpolated/uncertain point → low weight
bad telemetry                → reject
```

Then evaluate residuals.

------------------------------------------------------------------------

# 14. Coordinate System Strategy

Do not keep everything in latitude/longitude.

Convert to a local metric coordinate system.

Recommended conceptual pipeline:

``` text
WGS84 GPS
   ↓
Local ENU / projected metric frame
   ↓
metric camera trajectory
   ↓
3D reconstruction alignment
```

Store:

-   original WGS84;
-   local metric transform;
-   projected coordinates;
-   model origin;
-   CRS metadata.

This makes measurement and export reproducible.

------------------------------------------------------------------------

# 15. Core Module 6 --- Point Cloud Fusion

Inputs:

-   point maps/depth;
-   camera poses;
-   confidence;
-   dynamic masks.

Process:

``` text
per-frame geometry
       ↓
transform into global metric frame
       ↓
confidence filtering
       ↓
voxel/outlier filtering
       ↓
fusion
       ↓
georeferenced point cloud
```

Outputs:

-   PLY for demo;
-   LAS/LAZ where practical;
-   optional XYZ/CSV.

------------------------------------------------------------------------

# 16. Core Module 7 --- Mesh Generation

Start simple.

``` text
point cloud
   ↓
normal estimation
   ↓
outlier removal
   ↓
Poisson / alternative surface reconstruction
   ↓
mesh cleanup
   ↓
decimation
   ↓
texture projection
```

Do not spend hackathon time inventing a new meshing algorithm.

The innovation is upstream.

------------------------------------------------------------------------

# 17. Core Module 8 --- Texture Reconstruction

Goal:

Make the model understandable visually without compromising geometry.

Pipeline:

``` text
mesh
+
source frames
+
camera poses
   ↓
view selection
   ↓
texture projection
   ↓
texture atlas
   ↓
GLB/OBJ
```

If time is limited:

**geometry correctness \> texture quality.**

A gray but metrically correct model is more valuable than a beautiful
but inaccurate model.

------------------------------------------------------------------------

# 18. Core Module 9 --- Occlusion and Confidence

This should be one of our differentiating features.

Single-pass capture cannot magically observe every surface.

Therefore classify geometry:

### Observed

Supported by sufficient visual evidence.

### Weakly observed

Sparse observations / poor geometry.

### Inferred

Generated or completed using a model prior.

### Unknown

Insufficient evidence.

Example:

``` text
Confidence:
████████ High
██████░░ Medium
██░░░░░░ Low
░░░░░░░░ Unknown
```

The viewer should be able to toggle:

> **Show reconstruction confidence**

This makes the system more scientifically honest and operationally
useful.

------------------------------------------------------------------------

# 19. Core Module 10 --- Quality and Accuracy Engine

This should be a first-class component, not a final checkbox.

## Metrics

### Geometry

-   point count;
-   point density;
-   reprojection error where available;
-   depth consistency;
-   trajectory residual.

### Metric

-   scale error;
-   absolute positioning residual;
-   known-distance error.

### Completeness

-   percentage of reference area reconstructed;
-   coverage by scene region;
-   confidence-weighted coverage.

### Performance

-   video duration;
-   frames decoded;
-   frames retained;
-   inference time;
-   total processing time;
-   GPU memory.

### Robustness

-   dynamic-object contamination;
-   failed frames;
-   failed pose estimates;
-   low-confidence regions.

------------------------------------------------------------------------

# 20. Accuracy Validation Strategy

Do not say:

> "Our model is accurate."

Show it.

## Build a validation scene

Create or use a scene where we know:

-   building dimensions;
-   road width;
-   object distances;
-   altitude;
-   reference coordinates.

Then compare:

``` text
Reference
   vs
Our reconstruction
```

## Example report

``` text
Reference building width : 24.80 m
Reconstructed width      : 25.12 m
Absolute error           : 0.32 m
Relative error           : 1.29%
```

Repeat across several measurements.

## Ground truth options

Preferred:

1.  RTK/PPK surveyed reference;
2.  total station / known survey;
3.  known architectural dimensions;
4.  high-quality multi-pass reconstruction as a reference baseline.

Clearly label the source of ground truth.

------------------------------------------------------------------------

# 21. Completeness Validation

The PS cares about completeness.

Do not only measure "number of points."

Use:

-   reference-vs-reconstructed occupancy;
-   point-to-mesh distance;
-   cloud-to-cloud distance;
-   region coverage;
-   visible-surface coverage.

Example:

``` text
Reference surface
      ↓
sample points
      ↓
nearest reconstructed point
      ↓
distance threshold
      ↓
coverage %
```

Report:

-   coverage within 0.25 m;
-   coverage within 0.5 m;
-   coverage within 1.0 m.

Exact thresholds should be selected according to the official evaluation
dataset and reference data.

------------------------------------------------------------------------

# 22. Processing-Speed Strategy

The PS asks for near-real-time processing.

Do not define speed as:

> "AI inference is fast."

Measure the whole pipeline.

``` text
Decode
+
Frame selection
+
Masking
+
Reconstruction
+
Alignment
+
Fusion
+
Meshing
+
Texture
=
TOTAL TIME
```

## Optimization levers

-   adaptive frame sampling;
-   resize frames only as needed;
-   batch inference;
-   GPU inference;
-   mixed precision;
-   avoid redundant copies;
-   asynchronous preprocessing;
-   parallel telemetry parsing;
-   voxel downsampling;
-   optional texture generation;
-   cache intermediate results.

------------------------------------------------------------------------

# 23. Failure Detection

A production-style system should be able to say:

> "I cannot confidently reconstruct this flight."

Examples:

-   insufficient visual overlap;
-   excessive blur;
-   too little texture;
-   telemetry missing;
-   timestamps inconsistent;
-   trajectory alignment residual too high;
-   reconstruction confidence too low.

Instead of returning a bad model silently:

``` text
RECONSTRUCTION WARNING

Visual trajectory confidence: LOW
Telemetry synchronization:  FAILED
Estimated metric error:      HIGH

Recommendation:
Use RTK/PPK or provide camera intrinsics.
```

This is a major trust feature.

------------------------------------------------------------------------

# 24. User Experience

## Screen 1 --- Mission Upload

``` text
Upload:
[ Drone Video ]
[ GPS / Telemetry ]
[ Optional IMU ]
[ Optional Camera Parameters ]

[ START RECONSTRUCTION ]
```

## Screen 2 --- Processing

``` text
1. Ingestion             ✓
2. Frame Quality         ✓
3. Dynamic Filtering     ✓
4. 3D Reconstruction     ███████░░
5. Metric Alignment      ○
6. Mesh Generation       ○
7. Quality Validation    ○
```

## Screen 3 --- Reconstruction

Main viewport:

-   point cloud;
-   mesh;
-   flight path;
-   camera poses;
-   confidence overlay.

## Screen 4 --- Measure

Tools:

-   distance;
-   height;
-   elevation difference;
-   area;
-   optional volume.

## Screen 5 --- Report

``` text
Accuracy
Completeness
Confidence
Processing Time
Telemetry Quality
Export
```

------------------------------------------------------------------------

# 25. What the MVP Must Contain

## P0 --- Non-negotiable

-   [ ] Video ingestion
-   [ ] Telemetry ingestion
-   [ ] Frame extraction
-   [ ] Blur/quality filtering
-   [ ] Reconstruction backend
-   [ ] Camera trajectory
-   [ ] Metric/geographic alignment
-   [ ] Point cloud
-   [ ] Mesh
-   [ ] 3D viewer
-   [ ] Distance measurement
-   [ ] Quality report
-   [ ] GLB/OBJ/PLY export
-   [ ] End-to-end demo

## P1 --- Strong differentiators

-   [ ] Dynamic-object masking
-   [ ] Adaptive frame selection
-   [ ] Confidence map
-   [ ] Telemetry quality score
-   [ ] Robust alignment
-   [ ] Failure detection
-   [ ] Coverage analysis
-   [ ] Flight trajectory overlay

## P2 --- Post-MVP

-   [ ] Full Blender-like editing
-   [ ] Sculpting
-   [ ] Physics
-   [ ] CAD primitives
-   [ ] Advanced material editor
-   [ ] Real-time collaborative editing
-   [ ] Multi-drone fusion
-   [ ] Live onboard reconstruction
-   [ ] Advanced domain analytics

------------------------------------------------------------------------

# 26. What We Should Remove From the Current AeroMesh MVP

The repository currently describes a Blender-style editor with
object/edit/sculpt modes, transforms, primitives, modifiers, lighting,
physics and other studio functionality.

These are interesting product features but should not consume core
hackathon engineering time.

## Deprioritize

-   Blender hotkey recreation
-   sculpting
-   physics simulation
-   procedural terrain noise
-   large lighting system
-   CAD primitive generator
-   elaborate material controls
-   render snapshot engine
-   complex studio modifiers

## Keep

-   3D viewer
-   point cloud view
-   mesh view
-   camera/flight path
-   measurement
-   confidence
-   export
-   processing status
-   telemetry inspection

------------------------------------------------------------------------

# 27. Recommended Tech Stack

## Backend

**Python 3.11/3.12**

Why:

-   PyTorch ecosystem;
-   OpenCV;
-   Open3D;
-   geospatial libraries;
-   scientific computing.

## AI / Geometry

Primary candidates:

-   PyTorch
-   MapAnything
-   VGGT
-   VGGSfM
-   DUSt3R-compatible tooling

Do not lock the product to one model until benchmarked.

## Classical geometry fallback

-   COLMAP
-   PyCOLMAP

## Computer vision

-   OpenCV
-   optical flow
-   feature extraction/matching where required

## Segmentation

-   SAM 2 or another suitable segmentation/tracking system
-   motion-based filtering

## Point clouds / mesh

-   Open3D
-   Poisson reconstruction
-   KD-tree / nearest-neighbor operations

## Geospatial

-   PROJ / pyproj
-   rasterio where raster products are needed
-   shapely/geopandas if GIS vector analysis becomes necessary

## Backend API

-   FastAPI
-   Uvicorn

## Job processing

Start simple:

``` text
FastAPI
  ↓
background job
  ↓
pipeline
```

Move to Redis/Celery only if required.

## Frontend

-   React
-   Vite
-   Three.js
-   @react-three/fiber if useful
-   Leaflet or MapLibre for map layer

## Storage

For hackathon:

``` text
local filesystem
+
JSON metadata
+
SQLite
```

Do not introduce PostgreSQL unless the team actually needs it.

## Deployment

Prefer:

-   local GPU workstation;
-   on-premise GPU;
-   optional cloud GPU.

Because large reconstruction models can have substantial GPU memory
requirements.

------------------------------------------------------------------------

# 28. Recommended Repository Structure

``` text
AeroMesh/
│
├── README.md
├── ROADMAP.md
├── LICENSE
│
├── docs/
│   ├── problem_statement.md
│   ├── research.md
│   ├── architecture.md
│   ├── model_benchmark.md
│   ├── validation.md
│   ├── demo_script.md
│   └── judge_qa.md
│
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── requirements.txt
│   │
│   ├── pipeline/
│   │   ├── ingest.py
│   │   ├── quality.py
│   │   ├── telemetry.py
│   │   ├── synchronization.py
│   │   ├── masking.py
│   │   ├── reconstruction.py
│   │   ├── alignment.py
│   │   ├── fusion.py
│   │   ├── meshing.py
│   │   ├── texturing.py
│   │   ├── confidence.py
│   │   ├── validation.py
│   │   └── exporters.py
│   │
│   ├── backends/
│   │   ├── base.py
│   │   ├── colmap.py
│   │   ├── vggsfm.py
│   │   ├── vggt.py
│   │   └── mapanything.py
│   │
│   ├── scripts/
│   │   ├── process_flight.py
│   │   ├── benchmark_models.py
│   │   └── evaluate_reconstruction.py
│   │
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── UploadMission.jsx
│   │   │   ├── PipelineStatus.jsx
│   │   │   ├── Viewer3D.jsx
│   │   │   ├── FlightMap.jsx
│   │   │   ├── MeasurementTools.jsx
│   │   │   ├── ConfidenceOverlay.jsx
│   │   │   └── QualityReport.jsx
│   │   └── ...
│   └── package.json
│
├── data/
│   ├── raw/
│   ├── processed/
│   ├── ground_truth/
│   └── benchmark/
│
└── outputs/
    ├── pointcloud/
    ├── mesh/
    ├── textures/
    └── reports/
```

------------------------------------------------------------------------

# 29. Development Roadmap --- Phase by Phase

## PHASE 0 --- Research Lock

### Goal

Everyone understands the same problem.

### Deliverables

-   PS decomposition;
-   existing-technology matrix;
-   competitor matrix;
-   system architecture;
-   success metrics;
-   MVP definition.

### Exit condition

Every team member can answer:

> What is difficult about single-pass reconstruction?

in under 30 seconds.

------------------------------------------------------------------------

# PHASE 1 --- Baseline Reconstruction

### Goal

Prove that the raw video can produce useful geometry.

### Tasks

-   [ ] collect benchmark flight;
-   [ ] extract frames;
-   [ ] run COLMAP;
-   [ ] inspect camera trajectory;
-   [ ] generate dense point cloud;
-   [ ] generate mesh;
-   [ ] record runtime.

### Deliverable

``` text
video → point cloud → mesh
```

### Why this phase matters

If the baseline fails, adding five AI models will not fix our
understanding of the data.

------------------------------------------------------------------------

# PHASE 2 --- Learned Reconstruction Benchmark

### Goal

Compare modern geometry models.

### Tasks

Run the same selected frames through:

-   VGGT;
-   VGGSfM;
-   MapAnything;
-   DUSt3R-compatible pipeline.

### Record

  ------------------------------------------------------------------------------
  Backend             Time     Points   Coverage     Metric GPU memory Failure
                                                      error            
  ------------- ---------- ---------- ---------- ---------- ---------- ---------
  COLMAP                                                               

  VGGSfM                                                               

  VGGT                                                                 

  MapAnything                                                          

  DUSt3R                                                               
  ------------------------------------------------------------------------------

### Exit condition

Select a primary backend and at least one fallback.

------------------------------------------------------------------------

# PHASE 3 --- Intelligent Frame Selection

### Goal

Reduce computation while preserving geometry.

### Experiments

Compare:

-   1 FPS;
-   2 FPS;
-   4 FPS;
-   adaptive selection.

Measure:

-   reconstruction quality;
-   runtime;
-   memory;
-   completeness.

### Exit condition

Choose a documented sampling strategy.

------------------------------------------------------------------------

# PHASE 4 --- Telemetry Integration

### Goal

Move from relative reconstruction to a geographic/metric model.

### Tasks

-   parse GPS;
-   synchronize timestamps;
-   convert coordinates to local metric frame;
-   align camera trajectory;
-   calculate residuals;
-   add optional altitude/IMU.

### Exit condition

Model has:

-   scale;
-   orientation;
-   translation;
-   coordinate metadata.

------------------------------------------------------------------------

# PHASE 5 --- Dynamic Scene Robustness

### Goal

Prevent moving objects from contaminating static geometry.

### Tasks

-   segmentation;
-   tracking;
-   motion detection;
-   mask propagation;
-   compare reconstruction before/after masking.

### Exit condition

Dynamic contamination is measurably reduced on a test sequence.

------------------------------------------------------------------------

# PHASE 6 --- Confidence and Failure Detection

### Goal

Make the system trustworthy.

### Tasks

-   point/depth confidence;
-   telemetry confidence;
-   alignment residual;
-   coverage score;
-   observed/inferred labels;
-   failure thresholds.

### Exit condition

System can explain:

> "How confident are we?"

not merely:

> "Here is a mesh."

------------------------------------------------------------------------

# PHASE 7 --- Metric Validation

### Goal

Attack the highest-risk claim.

### Tasks

-   define ground truth;
-   measure known distances;
-   calculate absolute error;
-   calculate relative error;
-   evaluate multiple locations;
-   test different flight conditions.

### Deliverable

A reproducible validation table.

------------------------------------------------------------------------

# PHASE 8 --- Mesh + Texture + Export

### Goal

Create the final usable artifact.

### Tasks

-   point-cloud cleanup;
-   normals;
-   mesh;
-   texture;
-   GLB;
-   OBJ;
-   PLY;
-   optional LAS/LAZ.

### Exit condition

Output opens correctly in independent viewers.

------------------------------------------------------------------------

# PHASE 9 --- Web Application

### Goal

Turn the engine into a judge-friendly product.

### Core screens

1.  Upload
2.  Processing
3.  3D viewer
4.  Measurement
5.  Quality report
6.  Export

### Exit condition

A judge can understand the product without a developer explaining every
button.

------------------------------------------------------------------------

# PHASE 10 --- End-to-End Demo

### Demo sequence

``` text
1. Upload 10-minute drone video
2. Upload telemetry
3. Start reconstruction
4. Show processing stages
5. Show flight path
6. Show point cloud
7. Show final mesh
8. Toggle confidence
9. Measure a known object
10. Show validation result
11. Export model
```

------------------------------------------------------------------------

# 30. The 36-Hour Hackathon Plan

## Hours 0--3 --- Freeze scope

-   [ ] choose benchmark data;
-   [ ] confirm hardware;
-   [ ] assign roles;
-   [ ] freeze P0;
-   [ ] define demo.

## Hours 3--8 --- Geometry

-   [ ] baseline reconstruction;
-   [ ] learned backend running;
-   [ ] point cloud output.

## Hours 8--12 --- Telemetry

-   [ ] parser;
-   [ ] synchronization;
-   [ ] local coordinates;
-   [ ] alignment.

## Hours 12--16 --- Robustness

-   [ ] frame quality;
-   [ ] dynamic masking;
-   [ ] confidence.

## Hours 16--20 --- Mesh

-   [ ] surface reconstruction;
-   [ ] texture;
-   [ ] export.

## Hours 20--25 --- Frontend

-   [ ] upload;
-   [ ] pipeline status;
-   [ ] 3D viewer;
-   [ ] map;
-   [ ] measurement.

## Hours 25--29 --- Validation

-   [ ] accuracy measurements;
-   [ ] completeness;
-   [ ] speed;
-   [ ] failure cases.

## Hours 29--33 --- Presentation

-   [ ] architecture;
-   [ ] innovation;
-   [ ] competitor slide;
-   [ ] impact;
-   [ ] validation evidence.

## Hours 33--36 --- Hardening

-   [ ] demo rehearsal;
-   [ ] backup demo;
-   [ ] offline sample;
-   [ ] clean UI;
-   [ ] final judge Q&A.

------------------------------------------------------------------------

# 31. Team Roles

For a six-person team, a strong split is:

## Person 1 --- Geometry/ML Lead

Own:

-   reconstruction;
-   model benchmarking;
-   depth;
-   camera poses.

## Person 2 --- Geospatial/Telemetry

Own:

-   GPS;
-   IMU;
-   synchronization;
-   coordinate transforms;
-   alignment;
-   accuracy.

## Person 3 --- 3D Processing

Own:

-   point cloud;
-   fusion;
-   meshing;
-   texturing;
-   exports.

## Person 4 --- Backend

Own:

-   FastAPI;
-   pipeline orchestration;
-   jobs;
-   data contracts;
-   error handling.

## Person 5 --- Frontend / 3D UX

Own:

-   Three.js;
-   viewer;
-   flight map;
-   measurement;
-   confidence UI.

## Person 6 --- Product / Research / Presentation

Own:

-   competitor research;
-   validation protocol;
-   market/business;
-   PPT;
-   demo narrative;
-   judge Q&A.

Everyone must still understand the full architecture.

------------------------------------------------------------------------

# 32. Competition Matrix

  -------------------------------------------------------------------------
  Existing approach       What it already does    Where it differs from our
                                                  PS focus
  ----------------------- ----------------------- -------------------------
  COLMAP                  SfM + MVS + dense       General image
                          reconstruction          reconstruction; not a
                                                  complete single-pass
                                                  operational product

  OpenDroneMap            Aerial imagery →        Conventional aerial
                          georeferenced 3D/GIS    mapping workflow
                          outputs                 

  PIX4Dmapper             Professional drone      Designed around
                          photogrammetry, meshes, controlled/high-overlap
                          point clouds,           mapping workflows
                          measurements            

  Metashape               Mature photogrammetric  General photogrammetry
                          3D spatial processing   platform

  VGGSfM                  Learned SfM,            Research geometry
                          sequential/video        component, not our full
                          reconstruction, dynamic operational product
                          masks                   

  VGGT                    Feed-forward visual     Geometry foundation, not
                          geometry                our complete
                                                  telemetry/validation
                                                  application

  DUSt3R                  Learned geometric       Research reconstruction
                          reconstruction          foundation

  MapAnything             Universal feed-forward  General metric geometry
                          metric 3D               framework
                          reconstruction          

  3D Gaussian Splatting   High-quality novel-view Rendering quality is not
                          rendering               equivalent to metric
                                                  reconstruction

  Our system              Single-pass drone       Must prove the claims
                          workflow + telemetry +  experimentally
                          metric QA +             
                          confidence +            
                          operational UI          
  -------------------------------------------------------------------------

Important:

**Do not say "competitors cannot do this."**

Say:

> "Existing systems solve substantial parts of the problem; our
> differentiation is the constrained single-pass operational pipeline
> and the explicit integration of telemetry, quality validation and
> confidence."

------------------------------------------------------------------------

# 33. Business / Market Analysis

## Market categories

The opportunity sits across:

-   drone data services;
-   3D mapping and modeling;
-   photogrammetry;
-   geospatial software;
-   infrastructure inspection;
-   disaster mapping;
-   digital twins;
-   surveying.

Market research estimates vary substantially because vendors define
these markets differently.

Examples from recent industry reports:

-   Grand View Research estimates the global 3D mapping & modeling
    market at about **\$7.1B in 2024**, projected to about **\$16.8B by
    2030**.
-   IMARC estimates the global drone data services market at about
    **\$3.1B in 2025**, with a broader future forecast.
-   IMARC estimates India's 3D mapping and modeling market at about
    **\$344.6M in 2025**, with growth projected through 2034.

Treat these figures as directional market context, not as
interchangeable measurements.

## Primary beachhead

For the hackathon narrative, focus on users where a single-pass
constraint has high value:

### 1. Disaster response

-   damage assessment;
-   blocked-road assessment;
-   rapid terrain mapping.

### 2. Strategic / government mapping

-   rapid situational awareness;
-   difficult-to-access areas;
-   limited opportunities for repeated flights.

### 3. Infrastructure inspection

-   bridges;
-   roads;
-   towers;
-   construction sites.

### 4. Construction / surveying

-   progress capture;
-   site measurement;
-   as-built documentation.

## Business model after hackathon

Possible models:

### Enterprise/on-premise

Annual software license + GPU deployment.

### Per-flight processing

Pay per reconstruction.

### Cloud SaaS

Upload → process → store → analyze.

### Government deployment

On-premise / secure private deployment with support.

For the SIH demo, do not overfocus on revenue. Demonstrate operational
value first.

------------------------------------------------------------------------

# 34. Product Value Proposition

## Before

``` text
Capture
 ↓
Process large imagery dataset
 ↓
Long photogrammetry workflow
 ↓
Inspect output
 ↓
Measure
```

## Proposed

``` text
Single flight
 ↓
Upload video + telemetry
 ↓
AI-assisted reconstruction
 ↓
Metric/geographic alignment
 ↓
3D model + QA
 ↓
Measure immediately
```

## Core value

-   fewer capture requirements;
-   faster processing;
-   less operator dependence;
-   useful model after a constrained mission;
-   explicit quality/confidence information.

Do not promise "perfect reconstruction."

Promise a measurable reconstruction pipeline.

------------------------------------------------------------------------

# 35. Innovation Stack

Innovation should be presented at the **system level**.

## Innovation 1 --- Single-Pass Reconstruction

Designed around constrained viewpoint geometry.

## Innovation 2 --- Hybrid Geometry

Combine learned geometry with classical geometric validation/fallbacks.

## Innovation 3 --- Navigation-Aware Metric Alignment

Use GPS/IMU/altitude/RTK when available to anchor reconstruction.

## Innovation 4 --- Dynamic-Scene Robustness

Use semantic + temporal evidence to suppress moving objects.

## Innovation 5 --- Confidence-Aware Reconstruction

Separate observed, weakly observed, inferred and unknown geometry.

## Innovation 6 --- Built-In Validation

The product reports:

-   accuracy;
-   coverage;
-   processing time;
-   alignment residual;
-   confidence.

This is more defensible than simply saying "AI-generated 3D."

------------------------------------------------------------------------

# 36. The "Moat" Question

A judge may ask:

> "What stops Pix4D or another large company from copying this?"

Do not answer:

> "Our AI."

Instead:

Potential defensibility comes from:

-   specialized single-pass flight dataset;
-   telemetry-video synchronization;
-   robustness algorithms;
-   benchmark data;
-   validation methodology;
-   domain-specific model adaptation;
-   failure detection;
-   confidence estimation;
-   operational workflow;
-   deployment/security constraints.

The strongest long-term asset may become the **dataset + evaluation
pipeline + domain-specific reconstruction system**, not the UI.

------------------------------------------------------------------------

# 37. Technical Risks

  ------------------------------------------------------------------------
  Risk                                      Severity Mitigation
  --------------------- ---------------------------- ---------------------
  Learned model fails                           High Benchmark multiple
  on drone imagery                                   models + classical
                                                     fallback

  GPS noisy                                     High Robust weighted
                                                     alignment + residual
                                                     reporting

  Video timestamps                              High Explicit
  mismatch                                           synchronization
                                                     module

  Too few viewpoints                            High adaptive keyframe
                                                     selection + learned
                                                     priors

  Dynamic objects                               High segmentation + motion
  contaminate cloud                                  filtering

  Vegetation                                  Medium confidence +
  reconstructs poorly                                filtering

  Textureless surfaces                          High confidence +
                                                     classical/learned
                                                     comparison

  GPU memory                                    High frame batching +
                                                     downsampling + model
                                                     selection

  Mesh artifacts                              Medium point filtering +
                                                     normal estimation +
                                                     meshing cleanup

  Processing too slow                           High adaptive sampling +
                                                     profiling

  Demo network failure                          High offline benchmark
                                                     dataset

  Model hallucination                           High confidence +
                                                     validation +
                                                     observed/inferred
                                                     separation
  ------------------------------------------------------------------------

------------------------------------------------------------------------

# 38. The Three Hardest Technical Questions

Every team member must understand these.

## Q1. How can one flight produce 3D?

Answer:

The video contains many temporally adjacent viewpoints as the drone
moves. The system estimates camera motion and scene geometry from those
observations. Learned geometry priors can supplement conventional
multi-view constraints when the trajectory is poorly conditioned.

## Q2. How do we get meters rather than arbitrary units?

Answer:

The reconstruction is aligned to external navigation/metric information
such as GPS, altitude, IMU and, when available, RTK/PPK. The system
reports alignment residuals and validates measurements against reference
geometry.

## Q3. What about things we never saw?

Answer:

They are not treated as equally certain measurements. The system
distinguishes observed geometry from weak/inferred geometry and reports
confidence.

------------------------------------------------------------------------

# 39. Judge Objection Bank

Prepare answers to:

### "Why not Pix4D?"

Because our problem is specifically constrained single-pass
reconstruction and we are optimizing the pipeline around that
operational constraint.

### "Why AI?"

AI provides geometry priors and fast inference where classical
multi-view geometry becomes underconstrained.

### "Why not COLMAP?"

We use COLMAP as a baseline/fallback. The question is whether learned
geometry improves the single-pass trade-off of accuracy, completeness
and speed on the target data.

### "How do you prove accuracy?"

Reference measurements + reconstruction measurements + error statistics.

### "What is your ground truth?"

State exactly what reference source is used. Never invent a ground-truth
source.

### "Can you reconstruct the back of a building?"

Not from visual evidence that was never captured. Such geometry is
flagged as inferred/low confidence rather than represented as equally
certain measured geometry.

### "What happens if GPS is wrong?"

Telemetry is treated as noisy evidence. Alignment is weighted/robust and
residuals are reported.

### "What if there is no GPS?"

The system can produce relative geometry, but the metric/geographic
confidence must be downgraded unless another scale/reference source
exists.

### "What if the scene has moving cars?"

Dynamic masks and temporal motion cues reduce their contribution to
static geometry.

### "What if your AI model fails?"

A modular backend allows a classical reconstruction fallback and
explicit failure reporting.

### "How do you handle 4K?"

Decode and sample intelligently. Do not assume every frame must be
processed at full 4K resolution.

------------------------------------------------------------------------

# 40. Demo Story

The demo should tell one story.

## Scenario

> A drone gets only one opportunity to survey an area.

### Step 1

Show raw flight.

### Step 2

Show the flight path.

### Step 3

Upload video + telemetry.

### Step 4

System automatically selects useful frames.

### Step 5

Show reconstruction progress.

### Step 6

3D point cloud appears.

### Step 7

Mesh appears.

### Step 8

Toggle confidence.

### Step 9

Measure a known structure.

### Step 10

Show:

``` text
Measured value
Reference value
Absolute error
Processing time
Coverage
Confidence
```

### Step 11

Export.

That is the entire story.

------------------------------------------------------------------------

# 41. PPT Storyline

## Slide 1 --- Problem

Single-pass drone capture creates a constrained 3D reconstruction
problem.

## Slide 2 --- Why Existing Workflow Breaks

Multiple viewpoints, overlap and long processing are not always
available.

## Slide 3 --- Our Solution

Video + telemetry → metric 3D model.

## Slide 4 --- Architecture

Visual pipeline.

## Slide 5 --- Technical Innovation

-   learned geometry;
-   telemetry fusion;
-   dynamic suppression;
-   confidence;
-   validation.

## Slide 6 --- Competitor / Existing Technology

Show:

``` text
Existing systems
      ↓
Solve many parts
      ↓
Our focus
Single-pass + metric + rapid + validated
```

## Slide 7 --- Results

Only real benchmark numbers.

## Slide 8 --- Impact

Disaster / infrastructure / strategic mapping.

## Slide 9 --- Feasibility

Tech stack + deployment.

## Slide 10 --- Future

-   RTK;
-   edge processing;
-   multi-drone;
-   semantic analysis;
-   digital twins.

------------------------------------------------------------------------

# 42. Metrics Dashboard We Should Build

``` text
┌────────────────────────────────────────────┐
│             RECONSTRUCTION QA              │
├────────────────────────────────────────────┤
│ Processing Time       08:42                │
│ Frames Ingested       18,000               │
│ Frames Retained       1,126                │
│ Points                 3.2 M               │
│ Coverage               91.4 %               │
│ Metric Error           0.42 m               │
│ Alignment Residual     0.68 m               │
│ Geometry Confidence    89 %                 │
│ Dynamic Contamination  1.8 %               │
└────────────────────────────────────────────┘
```

**Only show values actually measured by the system.**

------------------------------------------------------------------------

# 43. Definition of Done

The project is NOT done when:

-   the frontend looks good;
-   a point cloud appears;
-   a mesh rotates;
-   an AI model runs.

The project is done when:

### Input

-   [ ] video works;
-   [ ] telemetry works;
-   [ ] synchronization works.

### Geometry

-   [ ] reconstruction works;
-   [ ] camera trajectory works;
-   [ ] point cloud works;
-   [ ] mesh works.

### Metric

-   [ ] scale is validated;
-   [ ] coordinate system is documented;
-   [ ] measurement error is reported.

### Robustness

-   [ ] blur filtering works;
-   [ ] dynamic filtering works;
-   [ ] confidence exists;
-   [ ] failure cases are visible.

### Performance

-   [ ] full pipeline is profiled;
-   [ ] runtime is known;
-   [ ] memory usage is known.

### Product

-   [ ] upload;
-   [ ] processing;
-   [ ] viewer;
-   [ ] measurement;
-   [ ] report;
-   [ ] export.

### Presentation

-   [ ] one clear story;
-   [ ] one clear innovation;
-   [ ] real benchmark results;
-   [ ] backup demo.

------------------------------------------------------------------------

# 44. Research Log --- What Must Be Experimentally Proven

Create a shared table and update it continuously.

  Question                                 Hypothesis   Experiment   Result   Decision
  ---------------------------------------- ------------ ------------ -------- ----------
  Which model is fastest?                                                     
  Which model is most complete?                                               
  Which model is most metrically stable?                                      
  How many frames are enough?                                                 
  Does masking improve reconstruction?                                        
  How much does GPS improve scale?                                            
  How much does IMU help?                                                     
  What mesh method works best?                                                
  What is the real end-to-end runtime?                                        
  What are our failure modes?                                                 

This table prevents the team from making architecture decisions based on
hype.

------------------------------------------------------------------------

# 45. Benchmark Protocol

Every model/backend comparison must use:

-   same input video;
-   same selected frames;
-   same telemetry;
-   same hardware;
-   same output resolution;
-   same evaluation metrics.

Record:

``` text
Hardware
GPU
VRAM
CPU
RAM

Input
video duration
resolution
FPS
frames selected

Output
points
mesh vertices
mesh faces

Quality
coverage
measurement error
alignment residual
confidence

Performance
preprocessing time
inference time
fusion time
meshing time
total time
```

------------------------------------------------------------------------

# 46. What NOT to Claim

Avoid these until independently verified:

-   "guaranteed 1 m accuracy";
-   "80× faster";
-   "real-time";
-   "perfect reconstruction";
-   "100% coverage";
-   "no GCPs required in all conditions";
-   "reconstructs hidden surfaces accurately";
-   "works on any drone";
-   "works on any environment".

Better wording:

> "Designed to target the PS's metric accuracy requirement."

> "Benchmark result: X on our test scene."

> "The system estimates hidden regions and reports lower confidence."

------------------------------------------------------------------------

# 47. Current AeroMesh Claims That Need Verification

The repository currently describes:

-   approximately 6.2-second processing for a particular 4K scenario;
-   an approximately 80× comparison against a traditional workflow;
-   meter-scale alignment using telemetry;
-   model options including VGGT-Ω, MapAnything and DUSt3R;
-   a large Blender-style editing environment.

These are useful **engineering hypotheses**, but they should not become
official project claims until the team reproduces and documents the
experiments.

Especially verify:

1.  exact hardware;
2.  video duration;
3.  number of frames;
4.  resolution;
5.  model checkpoint;
6.  GPU memory;
7.  whether masking time is included;
8.  whether meshing/texturing time is included;
9.  whether telemetry parsing is included;
10. whether the comparison baseline used the same data;
11. how metric accuracy was measured.

------------------------------------------------------------------------

# 48. Recommended Engineering Principle

## Build the smallest system that proves the PS.

Priority order:

``` text
1. Geometry
2. Metric accuracy
3. Completeness
4. Speed
5. Robustness
6. Measurement
7. Viewer
8. Presentation polish
9. Advanced editing
```

Do not reverse this order.

------------------------------------------------------------------------

# 49. Final Product Architecture --- Simplified

The whole project should be explainable in one diagram:

``` text
        SINGLE DRONE PASS
               │
        ┌──────┴───────┐
        ▼              ▼
     VIDEO         TELEMETRY
        │              │
        ▼              ▼
  Frame Intelligence  GPS/IMU
        │              │
        └──────┬───────┘
               ▼
        Learned Geometry
               +
        Classical Validation
               │
               ▼
       Metric Geo-Alignment
               │
               ▼
       Robust Point Fusion
               │
        ┌──────┴──────┐
        ▼             ▼
     Confidence      Point Cloud
        │             │
        └──────┬──────┘
               ▼
             Mesh
               │
               ▼
        3D Operational View
        ┌──────┼───────┐
        ▼      ▼       ▼
     Measure  QA     Export
```

------------------------------------------------------------------------

# 50. The One-Sentence Product Story

> **AeroMesh converts a single drone flight into a georeferenced,
> measurable 3D scene by combining learned visual geometry with flight
> telemetry, while explicitly measuring reconstruction quality and
> uncertainty.**

------------------------------------------------------------------------

# 51. The One-Sentence Innovation Story

> **Instead of treating drone video as a sequence of photographs for
> conventional photogrammetry, AeroMesh treats the entire flight as a
> constrained spatiotemporal reconstruction problem and combines learned
> geometry, navigation data and confidence-aware validation to make
> single-pass 3D reconstruction operationally useful.**

------------------------------------------------------------------------

# 52. The One-Sentence Judge Story

> **"If the drone gets only one chance to fly, AeroMesh turns that one
> flight into a measurable 3D model and tells the operator how much of
> the model can actually be trusted."**

------------------------------------------------------------------------

# 53. Final Evaluator Checklist

Before claiming the project is ready:

## Problem

-   [ ] Every feature maps to a PS requirement.
-   [ ] The team can explain why single-pass is difficult.
-   [ ] The team understands the difference between visual quality and
    metric accuracy.

## Technology

-   [ ] Existing solutions have been studied.
-   [ ] Classical baseline exists.
-   [ ] Learned models have been benchmarked.
-   [ ] Backend is modular.

## Accuracy

-   [ ] Ground truth is defined.
-   [ ] Measurement error is calculated.
-   [ ] Alignment residual is reported.
-   [ ] Confidence is shown.

## Completeness

-   [ ] Coverage is measured.
-   [ ] Occluded/inferred areas are identified.
-   [ ] Dynamic objects are evaluated.

## Performance

-   [ ] End-to-end runtime is measured.
-   [ ] GPU memory is measured.
-   [ ] Frame reduction strategy is documented.

## Product

-   [ ] Upload works.
-   [ ] Processing works.
-   [ ] Viewer works.
-   [ ] Measurement works.
-   [ ] Export works.
-   [ ] Offline demo works.

## Presentation

-   [ ] Problem is clear in 30 seconds.
-   [ ] Innovation is clear in 30 seconds.
-   [ ] Architecture is explainable.
-   [ ] Results are real.
-   [ ] Competitors are acknowledged.
-   [ ] Limitations are understood.
-   [ ] Demo has a backup.

------------------------------------------------------------------------

# 54. Immediate Next Actions

Do these in this exact order.

## Action 1 --- Freeze the research question

> **Can modern learned 3D reconstruction + telemetry produce a
> sufficiently accurate and complete metric model from a single drone
> pass faster than a conventional baseline?**

## Action 2 --- Build the benchmark

One representative drone video + telemetry + reference measurements.

## Action 3 --- Implement the simplest baseline

``` text
video
→ frames
→ COLMAP
→ point cloud
→ mesh
```

## Action 4 --- Implement one learned backend

Start with the most practical model available on the team's hardware.

## Action 5 --- Compare them

Accuracy / completeness / speed / robustness.

## Action 6 --- Add telemetry

Only after geometry works.

## Action 7 --- Add dynamic masking

Only after reconstruction works.

## Action 8 --- Add confidence

Before polishing the UI.

## Action 9 --- Build the minimal viewer

Only what is needed to demonstrate the value.

## Action 10 --- Validate and document

Every claim in the PPT should trace back to an experiment.

------------------------------------------------------------------------

# 55. Final Direction

The team should think of AeroMesh as three layers:

## Layer 1 --- Reconstruction Engine

**Hardest + most important**

``` text
Video → Geometry
```

## Layer 2 --- Metric Intelligence

**What makes it operational**

``` text
Geometry + Telemetry → Measurable Geo-referenced Scene
```

## Layer 3 --- Decision Interface

**What makes it demoable/useful**

``` text
Scene → View / Measure / Validate / Export
```

The first two layers are where the technical value lives.

The third layer should remain intentionally simple.

------------------------------------------------------------------------

# 56. Source Register

## Official PS / Team Materials

-   SIH26158 official problem statement: team-provided PDF /
    problem-statement material.
-   Team repository: https://github.com/MrEGAMERZ/AeroMesh
-   Team implementation plan:
    https://github.com/MrEGAMERZ/AeroMesh/blob/main/implementation_plan.md
-   Team documentation:
    https://github.com/MrEGAMERZ/AeroMesh/blob/main/DOCUMENTATION.md

## Classical Reconstruction

-   COLMAP: https://colmap.github.io/
-   COLMAP tutorial: https://colmap.github.io/tutorial
-   OpenDroneMap: https://opendronemap.org/odm/
-   OpenDroneMap outputs: https://docs.opendronemap.org/outputs/
-   PIX4Dmapper:
    https://www.pix4d.com/product/pix4dmapper-photogrammetry-software
-   Agisoft Metashape: https://www.agisoft.com/

## Learned Reconstruction

-   VGGSfM: https://github.com/facebookresearch/vggsfm
-   VGGT: https://github.com/facebookresearch/vggt
-   DUSt3R: https://github.com/naver/dust3r
-   MapAnything: https://github.com/facebookresearch/map-anything

## Market Context

Market estimates vary by source and definition. Use market numbers only
as contextual evidence and cite the exact report/version used in the
final PPT.

-   Grand View Research --- 3D Mapping & 3D Modeling:
    https://www.grandviewresearch.com/industry-analysis/3d-mapping-3d-modeling-market
-   IMARC --- Drone Data Services:
    https://www.imarcgroup.com/global-drone-data-services-market
-   IMARC --- India 3D Mapping & Modeling:
    https://www.imarcgroup.com/india-3d-mapping-modeling-market

------------------------------------------------------------------------

# 57. Document Status

**Status:** Master roadmap / research baseline

**Next milestone:** Benchmark the reconstruction engines on the same
flight.

**Rule:** Do not expand the feature set until the team has measured the
core trade-off between **accuracy, completeness and processing speed**.

**North Star:**

> **One flight → reliable metric 3D scene → measurable evidence.**
