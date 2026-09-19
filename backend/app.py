"""
app.py — FastAPI Server for Single-Pass Drone 3D Reconstruction Platform

Provides REST API endpoints for video/telemetry upload, pipeline execution tracking,
3D asset streaming (PLY point clouds, OBJ meshes), and pre-loaded flight sample datasets.
"""

import os
import shutil
import uuid
import asyncio
import gc
import time as _time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

_GPU_LOCK = asyncio.Lock()  # Ensures only 1 GPU job runs at a time
_GPU_QUEUE_DEPTH = 0        # Track pending jobs

app = FastAPI(
    title="SIH26158 Drone 3D Reconstruction Engine API",
    description="Feed-forward single-pass drone video to georeferenced 3D model API",
    version="1.0.0"
)

# Enable CORS for frontend development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent.resolve()
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "output"
SAMPLE_DIR = BASE_DIR / "samples"

for d in [UPLOAD_DIR, OUTPUT_DIR, SAMPLE_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# In-memory job tracker
JOBS = {}


@app.get("/")
def read_root():
    return {
        "project": "SIH26158: Single-Pass Drone Video to 3D Model",
        "status": "online",
        "supported_models": ["colmap", "vggsfm", "demo", "MapAnything (Meta/CMU)", "VGGT / VGGT-Omega (Oxford)", "DUSt3R/MASt3R"],
        "api_docs": "/docs"
    }


@app.get("/api/compute")
def get_compute_capabilities():
    """Discover available compute nodes and their supported engines."""
    nodes = []
    
    # 1. Local Node (dynamic detection)
    try:
        import torch
        gpu_available = torch.cuda.is_available()
        gpu_name = torch.cuda.get_device_name(0) if gpu_available else None
        gpu_memory = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1) if gpu_available else 0
    except ImportError:
        gpu_available = False
        gpu_name = None
        gpu_memory = 0
        
    if gpu_available:
        nodes.append({
            "id": "local_gpu",
            "name": "Local GPU",
            "device": gpu_name,
            "vram_gb": gpu_memory,
            "status": "available",
            "engines": ["vggsfm", "colmap", "demo"]
        })
    else:
        nodes.append({
            "id": "local_cpu",
            "name": "Local CPU",
            "device": "System CPU",
            "vram_gb": 0,
            "status": "available",
            "engines": ["colmap", "demo"]
        })
        
    # 2. Remote / University Cluster (mocked)
    nodes.append({
        "id": "university_cluster",
        "name": "University Cluster",
        "device": "NVIDIA H200 PCIe",
        "vram_gb": 141.0,
        "status": "unavailable",
        "engines": ["vggsfm", "vggt", "colmap", "demo"]
    })
    
    # 3. Cloud GPU (mocked)
    nodes.append({
        "id": "cloud_gpu",
        "name": "Cloud Deployment",
        "device": "AWS g6.xlarge (L4)",
        "vram_gb": 24.0,
        "status": "unavailable",
        "engines": ["vggsfm", "vggt", "mapanything", "colmap"]
    })
    
    return {"compute_backends": nodes}

@app.get("/api/status")

def system_status():
    try:
        import torch
        gpu_available = torch.cuda.is_available()
        gpu_name = torch.cuda.get_device_name(0) if gpu_available else None
        gpu_memory_total = torch.cuda.get_device_properties(0).total_memory // 1024**2 if gpu_available else None
        gpu_memory_used = torch.cuda.memory_allocated(0) // 1024**2 if gpu_available else None
    except ImportError:
        gpu_available = False
        gpu_name = gpu_memory_total = gpu_memory_used = None
    
    active_jobs = [j for j in JOBS.values() if j.get("status") == "processing"]
    queued_jobs = [j for j in JOBS.values() if j.get("status") == "queued"]
    
    return {
        "gpu_available": gpu_available,
        "gpu_name": gpu_name,
        "gpu_memory_total_mb": gpu_memory_total,
        "gpu_memory_used_mb": gpu_memory_used,
        "active_jobs": len(active_jobs),
        "queued_jobs": len(queued_jobs),
        "gpu_lock_held": _GPU_LOCK.locked(),
    }

@app.get("/api/samples")
def get_sample_datasets():
    """List pre-configured drone flight scenarios for instant demonstration."""
    return {
        "samples": [
            {
                "id": "urban-quadrant",
                "title": "Urban Infrastructure Corridor",
                "location": "Sector 62, Noida, India",
                "altitude_m": 45.0,
                "flight_type": "Single-Pass Oblique",
                "duration_s": 24.5,
                "frames_count": 48,
                "estimated_accuracy": "± 1.4m (GPS-referenced)",
                "description": "Commercial block inspection capturing dynamic vehicular traffic and multi-story structures.",
                "point_count": 42500,
                "has_mesh": True
            },
            {
                "id": "rural-quarry",
                "title": "Open-Cast Mining & Terrain Relief",
                "location": "Aravalli Ridge, Rajasthan",
                "altitude_m": 68.0,
                "flight_type": "Single-Pass Nadir Grid",
                "duration_s": 38.0,
                "frames_count": 76,
                "estimated_accuracy": "± 0.9m (Scale-anchored)",
                "description": "High-gradient elevation survey mapping terraced excavation cuts and stockpiles.",
                "point_count": 56000,
                "has_mesh": True
            },
            {
                "id": "bridge-span",
                "title": "Highway Viaduct & River Span",
                "location": "Yamuna Expressway Spur",
                "altitude_m": 35.0,
                "flight_type": "Single-Pass Follow-Along",
                "duration_s": 19.2,
                "frames_count": 38,
                "estimated_accuracy": "± 1.1m (Fused IMU/GPS)",
                "description": "Infrastructure monitoring pass with river surface specular reflection handling.",
                "point_count": 39800,
                "has_mesh": True
            }
        ]
    }


@app.post("/api/jobs/create")
async def create_pipeline_job(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    telemetry: UploadFile = File(...),
    model: str = Form("demo"),
    compute_backend: str = Form("local_gpu"),
    target_fps: float = Form(2.0),
    enable_masking: bool = Form(True)
):
    """
    Upload drone video + telemetry log, initialize asynchronous reconstruction job.
    """
    valid_models = ["colmap", "vggsfm", "vggt", "mapanything", "demo"]
    if model not in valid_models:
        raise HTTPException(status_code=400, detail=f"Invalid model. Must be one of {valid_models}")

    job_id = str(uuid.uuid4())[:8]
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # Save uploaded files
    video_path = job_dir / video.filename
    telemetry_path = job_dir / telemetry.filename

    with open(video_path, "wb") as f:
        shutil.copyfileobj(video.file, f)
    with open(telemetry_path, "wb") as f:
        shutil.copyfileobj(telemetry.file, f)

    JOBS[job_id] = {
        "id": job_id,
        "status": "queued",
        "progress": 5,
        "current_stage": "Initializing job environment",
        "video_file": video.filename,
        "telemetry_file": telemetry.filename,
        "model": model,
        "compute_backend": compute_backend,
        "created_at": str(asyncio.get_event_loop().time()),
        "summary": None,
        "queue_position": 0,
        "compute_device_name": "Unknown",
        "vram_used_gb": 0.0,
        "vram_total_gb": 0.0
    }
    
    if compute_backend not in ["local_gpu", "local_cpu"]:
        raise HTTPException(status_code=400, detail="Requested compute backend is currently unavailable.")

    # Run processing asynchronously
    background_tasks.add_task(
        execute_job_pipeline,
        job_id=job_id,
        video_path=str(video_path),
        telemetry_path=str(telemetry_path),
        job_dir=str(job_dir),
        model=model,
        compute_backend=compute_backend,
        target_fps=target_fps,
        enable_masking=enable_masking
    )

    return {"job_id": job_id, "status": "queued", "message": "Pipeline execution started"}


async def execute_job_pipeline(
    job_id: str,
    video_path: str,
    telemetry_path: str,
    job_dir: str,
    model: str,
    compute_backend: str,
    target_fps: float,
    enable_masking: bool
):
    from scripts.process_flight import run_pipeline
    global _GPU_QUEUE_DEPTH
    
    _GPU_QUEUE_DEPTH += 1
    JOBS[job_id]["queue_position"] = _GPU_QUEUE_DEPTH

    async with _GPU_LOCK:
        _GPU_QUEUE_DEPTH -= 1
        JOBS[job_id]["queue_position"] = 0
        JOBS[job_id]["status"] = "processing"

        try:
            JOBS[job_id]["progress"] = 20
            JOBS[job_id]["current_stage"] = "Parsing telemetry & extracting sharp frames..."
            await asyncio.sleep(0.5)

            JOBS[job_id]["progress"] = 45
            JOBS[job_id]["current_stage"] = "Executing dynamic object masking (SAM2 / motion filter)..."
            await asyncio.sleep(0.5)

            JOBS[job_id]["progress"] = 70
            JOBS[job_id]["current_stage"] = f"Feed-forward 3D transformer forward pass ({model.upper()})..."

            # Fetch hardware stats for UI
            try:
                import torch
                if torch.cuda.is_available():
                    JOBS[job_id]["compute_device_name"] = torch.cuda.get_device_name(0)
                    JOBS[job_id]["vram_total_gb"] = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1)
                else:
                    JOBS[job_id]["compute_device_name"] = "System CPU"
            except ImportError:
                JOBS[job_id]["compute_device_name"] = "System CPU"
                
            # Run pipeline
            summary = run_pipeline(
                video_path=video_path,
                telemetry_path=telemetry_path,
                output_dir=job_dir,
                target_fps=target_fps,
                model_name=model,
                enable_masking=enable_masking
            )

            try:
                import torch
                if torch.cuda.is_available():
                    JOBS[job_id]["vram_used_gb"] = round(torch.cuda.memory_allocated(0) / (1024**3), 2)
            except ImportError:
                pass
            JOBS[job_id]["progress"] = 90
            JOBS[job_id]["current_stage"] = "Poisson surface meshing & georeferencing..."
            await asyncio.sleep(0.2)

            JOBS[job_id]["progress"] = 100
            JOBS[job_id]["status"] = "completed"
            JOBS[job_id]["current_stage"] = "Ready for 3D inspection"
            JOBS[job_id]["summary"] = summary

        except Exception as e:
            JOBS[job_id]["status"] = "failed"
            JOBS[job_id]["error"] = str(e)
            JOBS[job_id]["current_stage"] = f"Error: {str(e)}"
        finally:
            # Always release GPU memory even on error
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except ImportError:
                pass
            try:
                import gc
                gc.collect()
            except Exception:
                pass


@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    """Retrieve job progress, logs, and artifacts."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return JOBS[job_id]


@app.get("/api/jobs/{job_id}/artifact/{artifact_name}")
def download_artifact(job_id: str, artifact_name: str):
    """Download output files (OBJ, PLY, JSON)."""
    target_file = OUTPUT_DIR / job_id / artifact_name
    if not target_file.exists():
        raise HTTPException(status_code=404, detail="Artifact file not found")
    return FileResponse(str(target_file))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
