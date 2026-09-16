"""
process_flight.py — End-to-End CLI Pipeline Runner

Takes a raw single-pass drone video and flight telemetry (CSV/JSON/SRT),
runs through the full ingestion, dynamic masking, feed-forward 3D reconstruction,
georeferencing alignment, and surface meshing stages, and outputs 3D models and JSON metadata.
"""

import os
import sys
import argparse
import json
import time
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent.resolve()))

from pipeline.ingest import VideoIngestor, IngestConfig
from pipeline.telemetry import TelemetryParser, TrajectoryAligner
from pipeline.dynamic_masking import DynamicObjectMasker, MaskingConfig
from pipeline.reconstruction import ReconstructionEngine, ReconstructionConfig
from pipeline.meshing import MeshGenerator, MeshingConfig


def run_pipeline(
    video_path: str,
    telemetry_path: str,
    output_dir: str,
    target_fps: float = 2.0,
    model_name: str = "vggt",
    enable_masking: bool = True
):
    print("=================================================================")
    print("  SIH26158: Single-Pass Drone Video -> 3D Reconstruction Pipeline ")
    print("=================================================================")
    start_time = time.time()
    os.makedirs(output_dir, exist_ok=True)

    # 1. Telemetry Ingestion
    print("\n--- [Step 1/5] Ingesting Drone Flight Telemetry ---")
    parser = TelemetryParser()
    trajectory = parser.parse(telemetry_path)
    print(f"Parsed {len(trajectory.points)} telemetry points.")
    print(f"Flight Duration: {trajectory.duration_s:.1f}s | Mean Altitude: {trajectory.mean_altitude:.1f}m")
    bbox = trajectory.bounding_box
    print(f"Bounding Box: Lat [{bbox['min_lat']:.5f}, {bbox['max_lat']:.5f}], Lon [{bbox['min_lon']:.5f}, {bbox['max_lon']:.5f}]")

    # 2. Video Frame Ingestion & Sharpness Filter
    print("\n--- [Step 2/5] Extracting Frames with Laplacian Blur Filtering ---")
    frames_dir = os.path.join(output_dir, "extracted_frames")
    ingestor = VideoIngestor(IngestConfig(target_fps=target_fps, blur_threshold=90.0))
    valid_frames = ingestor.extract_frames(video_path, frames_dir)
    print(f"Extracted {len(valid_frames)} sharp, non-redundant frames.")

    frame_paths = ingestor.get_frame_paths()
    timestamps = ingestor.get_timestamps()

    # 3. Dynamic Object Masking (SAM2 / Motion Diff)
    print("\n--- [Step 3/5] Dynamic Object Masking (Vehicles & Pedestrians) ---")
    if enable_masking and frame_paths:
        masking_dir = os.path.join(output_dir, "masked_output")
        masker = DynamicObjectMasker(MaskingConfig(method="motion_diff"))
        mask_results = masker.mask_frames(frame_paths, masking_dir)
        recon_input_paths = [r.masked_path for r in mask_results]
        summary = masker.summary(mask_results)
        print(f"Masking complete: {summary['frames_with_dynamics']} frames had dynamic objects removed.")
    else:
        recon_input_paths = frame_paths
        print("Masking skipped or no frames extracted.")

    # 4. Feed-Forward 3D Reconstruction (MapAnything / VGGT)
    print(f"\n--- [Step 4/5] Feed-Forward 3D Transformer Inference ({model_name.upper()}) ---")
    recon_engine = ReconstructionEngine(ReconstructionConfig(model=model_name))
    recon_result = recon_engine.reconstruct(
        recon_input_paths,
        initial_altitude=trajectory.mean_altitude
    )
    print(f"Generated 3D Point Cloud with {len(recon_result.point_cloud.points):,} points.")

    # 4b. Georeferencing & Scale Anchoring via Telemetry
    print("\n--- [Step 4b/5] Aligning Camera Trajectory to GPS/IMU Coordinates ---")
    aligner = TrajectoryAligner()
    cam_positions = np.array([p.translation for p in recon_result.camera_poses])
    
    if len(cam_positions) > 0 and len(trajectory.points) > 0:
        R, t, scale = aligner.align_reconstruction(cam_positions, trajectory, timestamps[:len(cam_positions)])
        # Rigidly transform point cloud into georeferenced metric coordinate frame
        recon_result.point_cloud.points = aligner.transform_points(
            recon_result.point_cloud.points, R, t, scale
        )
        print(f"Calculated Rigid Transform: Scale Factor={scale:.4f}, GPS Trajectory Synchronized.")

    # Save point cloud
    ply_path = os.path.join(output_dir, "reconstructed_pointcloud.ply")
    recon_engine.save_point_cloud_ply(recon_result, ply_path)
    recon_engine.save_cameras_json(recon_result, os.path.join(output_dir, "camera_trajectory.json"))

    # 5. Poisson Surface Reconstruction & Mesh Texturing
    print("\n--- [Step 5/5] Poisson Surface Reconstruction & Texturing ---")
    mesh_gen = MeshGenerator(MeshingConfig(depth=8))
    mesh_output = mesh_gen.generate_mesh(recon_result.point_cloud)
    obj_path = os.path.join(output_dir, "reconstructed_mesh.obj")
    mesh_gen.export_obj(mesh_output, obj_path)

    # Save pipeline summary
    elapsed = time.time() - start_time
    summary_data = {
        "status": "success",
        "elapsed_seconds": round(elapsed, 2),
        "point_count": len(recon_result.point_cloud.points),
        "vertex_count": len(mesh_output.vertices),
        "face_count": len(mesh_output.triangles),
        "flight_duration_s": trajectory.duration_s,
        "mean_altitude_m": trajectory.mean_altitude,
        "bounding_box": trajectory.bounding_box,
        "artifacts": {
            "point_cloud_ply": ply_path,
            "mesh_obj": obj_path,
            "trajectory_json": os.path.join(output_dir, "camera_trajectory.json")
        }
    }
    with open(os.path.join(output_dir, "flight_summary.json"), "w") as f:
        json.dump(summary_data, f, indent=2)

    print("\n=================================================================")
    print(f"  Pipeline Finished in {elapsed:.2f}s!")
    print(f"  Mesh: {obj_path}")
    print(f"  Point Cloud: {ply_path}")
    print("=================================================================\n")
    return summary_data


if __name__ == "__main__":
    import numpy as np
    parser = argparse.ArgumentParser(description="SIH26158 Single-Pass Drone Video to 3D Pipeline")
    parser.add_argument("--video", type=str, required=True, help="Path to input video file")
    parser.add_argument("--telemetry", type=str, required=True, help="Path to telemetry CSV/JSON/SRT file")
    parser.add_argument("--output", type=str, default="./output", help="Output directory")
    parser.add_argument("--fps", type=float, default=2.0, help="Target extraction FPS")
    parser.add_argument("--model", type=str, default="vggt", choices=["vggt", "mapanything", "dust3r"])
    args = parser.parse_args()

    run_pipeline(
        video_path=args.video,
        telemetry_path=args.telemetry,
        output_dir=args.output,
        target_fps=args.fps,
        model_name=args.model
    )
