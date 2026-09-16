# AeroMesh 3D — User Guide & Operator Manual
**SIH26158: Single-Pass Aerial Video to 3D Reconstruction Platform**

---

## 📖 Introduction

**AeroMesh 3D** is a next-generation aerial photogrammetry and interactive 3D studio designed to convert single-pass drone videos and flight telemetry into georeferenced, metrically accurate 3D point clouds and textured meshes. 

Unlike traditional multi-pass flight planning that requires hours of cross-hatch surveying and dense Ground Control Points (GCPs), AeroMesh 3D leverages **feed-forward 3D transformers** (`VGGT-Ω`, `MapAnything`, `DUSt3R`) and real-time GPU acceleration to reconstruct environments directly in a single pass.

---

## 🖥️ Platform Interface Overview

The AeroMesh 3D workspace is engineered with a **minimalist, space-optimized aerospace layout**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Compass] AEROMESH 3D  SIH26158  ● H200   Flight: [Urban|Quarry|Viaduct]  Engine: [VGGT]│ Topbar (38px)
├──────┬─────────────────────────────────────────────────────────────┬───────────────────┤
│ T    │                                                             │ N-Panel (Props)   │
│ O    │                                                             │ ───────────────── │
│ O    │                     3D VIEWPORT CANVAS                      │ ☼ Lighting        │
│ L    │                     (Three.js WebGL)                        │ △ Materials       │
│ B    │                                                             │ ☁ Environment     │
│ A    │                                                             │ ༄ Physics Engine  │
│ R    │                                                             │ ▣ Transform & Imp │
│      ├─────────────────────────────────────────────────────────────┴───────────────────┤
│ (28p)│ Status Bar: 1 Unit = 1.00 m  ·  WGS84  ·  Surface (-38.87, -6.78, -3.63)         │
└──────┴─────────────────────────────────────────────────────────────────────────────────┘
```

1. **Ultra-Compact Topbar (38px)**:
   - System branding & real-time **H200 Clustered GPU** status.
   - **Flight Scenario Switcher**: Instant switching between `Urban Infrastructure`, `Open-Cast Quarry`, and `Highway Viaduct`.
   - **AI Engine Selector**: Select between `VGGT-Ω (Oxford/Meta)`, `MapAnything (Meta/CMU)`, and `DUSt3R (Pairwise)`.
   - **New Flight Pass**: Ingestion modal for custom MP4 drone video and GPS telemetry logs.
   - **Export 3D**: Direct georeferenced `.obj` download.

2. **Left T-Panel (Toolbox)**:
   - Quick-access icons for navigation, Blender-style transformations, measurement, physics toggles, and model import.

3. **Center 3D Viewport**:
   - Orbit, pan, and zoom controls.
   - Header with `Object` / `Edit` mode switchers, view modes (Hybrid, Mesh, Point Cloud, Wireframe, Camera Frustums, Elevation Color Ramp), FPS monitor, and point/polygon counters.
   - Expandable/collapsible N-Panel toggle (`[N]`).

4. **Right N-Panel (Properties Sidebar)**:
   - Collapsible accordions for lighting, materials, environment, physics simulation, object transform, and hotkey cheatsheet. Can be collapsed or expanded at any time to maximize canvas space.

---

## 🎨 Blender-Style 3D Editing & Manipulation

AeroMesh 3D brings familiar Blender keyboard workflows and CAD precision directly into the browser:

### 1. Object Transformation Modes
Select any object or imported mesh, then press the following standard Blender hotkeys:

| Hotkey | Action | Description |
|---|---|---|
| **`G`** | **Grab / Translate** | Move the object in 3D space following your mouse. |
| **`R`** | **Rotate** | Rotate the object around the vertical Y/Z axis. |
| **`S`** | **Scale** | Uniformly scale the model up or down. |
| **`X` / `Y` / `Z`** | **Axis Constraint** | When in Grab/Rotate/Scale mode, locks movement strictly to the chosen coordinate axis. |
| **`Enter`** / **Left-Click** | **Confirm** | Commits the transform changes. |
| **`Esc`** / **Right-Click** | **Cancel** | Reverts the transform back to the pre-operation state. |

### 2. Tab: Object vs. Edit Mode
- Press **`Tab`** or click the top mode pill (`Object` / `Edit`) to switch modes.
- In **Edit Mode**:
  - Vertex markers appear across the geometry.
  - Click on vertex markers to select them (hold `Shift` for multi-select).
  - Press **`G`** to grab and sculpt the selected vertices directly, modifying the 3D surface relief.

### 3. N-Panel Transform Sliders
Inside the **Object tab (`▣`)** of the right N-panel:
- Precise numeric sliders for **Position (X, Y, Z)**, **Rotation (X, Y, Z in degrees)**, and **Scale (X, Y, Z)**.
- **Reset Transform** button to quickly re-center or reset scaling.

---

## 📦 Importing & Editing External 3D Models

AeroMesh 3D allows users to import external CAD models, architectural BIM assets, or third-party survey meshes and edit them side-by-side with aerial survey data.

### Supported File Formats:
- **`.obj`** (Wavefront 3D Object)
- **`.glb` / `.gltf`** (glTF Binary & JSON)
- **`.stl`** (Stereolithography 3D print mesh)
- **`.ply`** (Polygon File Format / Point Clouds)

### How to Import:
1. Click the **Upload icon (`⇪`)** in the left T-panel, **OR** open the **Object tab (`▣`)** in the N-panel and click **"Choose 3D File"**.
2. Select your file from the local file picker.
3. The engine automatically:
   - Computes vertex normals and bounding extents.
   - Normalizes metric scale to match the survey coordinate frame.
   - Centers the model and places it onto the terrain ground plane.
   - Sets the imported mesh as the **Active Target** for all transform tools (`G`, `R`, `S`) and Edit Mode (`Tab`).
4. An active model badge will appear in the footer showing the file name, vertex count, and face count.
5. To revert back to the survey mesh, simply click **"Unload Model"** in the N-panel or the **`×`** button in the footer badge.

---

## 💡 Lighting, PBR Materials & Environment

### Lighting Tab (`☼`)
- **Sun Light**: Adjust intensity ($0$ to $5$), sun color swatch, directional coordinates ($X, Y, Z$), and real-time shadow map casting (`PCFSoftShadowMap`).
- **Ambient Light**: Fill shadow areas with soft omnidirectional ambient light.
- **Fill Light & Back Light**: Studio 3-point lighting setup for rim definition on building facades and quarry benches.
- **Point Light**: Local omnidirectional point light with adjustable intensity and placement.

### Material Tab (`△`)
- **Base Color & Emissive**: Tint the surface or simulate thermal/luminescent surfaces.
- **Roughness & Metalness**: Tune physically-based rendering (PBR) reflectance.
- **Opacity & Transparency**: X-ray transparency for inspecting underground infrastructure or structural layers.
- **Shading Toggle**: Toggle between **Smooth Shading** and **Flat Shading** (faceted polygon visualization).
- **Point Cloud Particle Size**: Adjust point diameter ($0.5\text{px}$ to $8.0\text{px}$) for dense point clouds.

### World Tab (`☁`)
- **Background Color**: Set custom dark, light, or chromatic studio backdrops.
- **Atmospheric Fog**: Enable distance exponential fog with density and tint controls.
- **Metric Ground Grid**: Toggle the $160\text{m} \times 160\text{m}$ coordinate grid.
- **Tone Mapping & Exposure**: Select between `ACES Filmic`, `Reinhard`, `Linear`, or `None`, with precision exposure tuning ($0.1\times$ to $4.0\times$).

---

## 🌪️ Real-Time Physics Simulation

AeroMesh 3D incorporates a real-time particle/mesh dynamics engine for stress simulation, rockfall prediction, and environmental flow testing:

1. Click the **Physics icon (`༄`)** in the left T-panel or open the **Physics Tab (`༄`)** in the N-Panel.
2. Toggle **Simulation Active**:
   - **Gravity**: Accelerates point particles and vertices toward the ground plane.
   - **Bounce (Restitution)**: Controls elastic collision rebound upon hitting the terrain surface or floor.
   - **Turbulence**: Adds stochastic aerodynamic perturbations.
   - **Floor Elevation**: Sets the ground plane threshold ($Y$-axis altitude).
   - **Wind Force ($X, Z$)**: Applies directional wind vectors to simulate crosswind dispersion and atmospheric drift.
3. Click **Reset Simulation** (`↺`) at any time to instantly restore geometry to original coordinates.

---

## 📏 Metric Spatial Toolkit & GIS Telemetry

- **3D Euclidean Distance**: Click **"Enable Ruler"** in the sidebar, then select two points on the 3D surface. The toolkit calculates exact real-world 3D distance ($D_{\text{3D}} = \sqrt{\Delta X^2 + \Delta Y^2 + \Delta Z^2}$).
- **Elevation Change ($\Delta Z$)**: Instant vertical height difference between foundation and rooftop or quarry benches.
- **Surface Slope / Gradient**: Automatic angle computation ($\theta = \arctan(\Delta Z / D_{\text{2D}})$).
- **Flight Path & Telemetry Track**: The right GIS sidebar renders synchronized RTK GPS coordinates, ground speed ($v$), heading ($\psi$), and barometric altitude ($z_{\text{AGL}}$).

---

## ⌨️ Complete Keyboard Shortcuts Reference

| Shortcut | Context | Action |
|---|---|---|
| **`Tab`** | Global | Toggle between **Object Mode** and **Edit Mode** |
| **`G`** | Viewport | Start **Grab / Translate** operation |
| **`R`** | Viewport | Start **Rotate** operation |
| **`S`** | Viewport | Start **Scale** operation |
| **`X`** | During G/R/S | Lock movement to **X Axis** |
| **`Y`** | During G/R/S | Lock movement to **Y Axis** |
| **`Z`** | During G/R/S | Lock movement to **Z Axis** |
| **`Enter`** / **Click** | During G/R/S | **Confirm** transform |
| **`Esc`** | During G/R/S | **Cancel** and reset transform |
| **`N`** | Viewport | **Toggle N-Panel** (expand / diminish sidebar) |
| **`Left Mouse Drag`** | Viewport | Orbit camera |
| **`Shift + Left Drag`** | Viewport | Pan camera |
| **`Mouse Wheel`** | Viewport | Zoom in / Zoom out |
| **`Shift + Click`** | Edit Mode | Multi-select vertices |
