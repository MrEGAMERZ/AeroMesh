"""
reconstruction.py — Feed-Forward 3D Transformer Reconstruction Engine

[DEPRECATED] This file is a monolith and is deprecated.
Please use the new pluggable engine system in `backend/pipeline/engines/` instead.

Wraps feed-forward 3D reconstruction models (MapAnything, VGGT, DUSt3R)
to produce point clouds and camera poses from drone video frames in a
single forward pass — no iterative bundle adjustment required.
"""

import os
import numpy as np
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CameraPose:
    """Estimated camera pose for a single frame."""
    frame_index: int
    rotation: np.ndarray        # 3x3 rotation matrix
    translation: np.ndarray     # 3x1 translation vector
    focal_length: Optional[float] = None
    principal_point: Optional[tuple[float, float]] = None


@dataclass
class PointCloud:
    """Reconstructed 3D point cloud."""
    points: np.ndarray          # Nx3 array of 3D positions
    colors: np.ndarray          # Nx3 array of RGB colors (0-255)
    normals: Optional[np.ndarray] = None   # Nx3 normals
    confidence: Optional[np.ndarray] = None  # N, per-point confidence scores


@dataclass
class ReconstructionResult:
    """Complete output of the reconstruction pipeline."""
    point_cloud: PointCloud
    camera_poses: list[CameraPose]
    scale_factor: float         # Metric scale factor
    depth_maps: Optional[list[np.ndarray]] = None  # Per-frame depth maps


@dataclass
class ReconstructionConfig:
    """Configuration for 3D reconstruction."""
    model: str = "vggt"             # "mapanything", "vggt", "dust3r"
    device: str = "cuda"
    max_frames: int = 200           # Maximum frames to process at once
    confidence_threshold: float = 0.5
    use_metric_depth: bool = True   # Use metric depth estimation
    camera_intrinsics: Optional[dict] = None  # {fx, fy, cx, cy}
    checkpoint_path: Optional[str] = None


class ReconstructionEngine:
    """
    Feed-forward 3D reconstruction engine.
    
    Supports multiple model backends:
    - MapAnything: Best metric accuracy with GPS/intrinsics fusion
    - VGGT/VGGT-Ω: Robust single-pass video-to-pointcloud
    - DUSt3R/MASt3R: Mature pairwise stereo (fallback)
    
    For hackathon/demo, includes a synthetic point cloud generator
    to demonstrate the full pipeline without GPU inference.
    """

    def __init__(self, config: Optional[ReconstructionConfig] = None):
        self.config = config or ReconstructionConfig()
        self.model = None

    def _load_model(self):
        """Load the specified reconstruction model."""
        model_name = self.config.model.lower()

        if model_name == "mapanything":
            return self._load_mapanything()
        elif model_name in ("vggt", "vggt_omega"):
            return self._load_vggt()
        elif model_name in ("dust3r", "mast3r"):
            return self._load_dust3r()
        else:
            print(f"[Recon] Unknown model '{model_name}', using synthetic demo mode")
            return None

    def _load_mapanything(self):
        """Load MapAnything model."""
        try:
            # MapAnything integration point
            # from map_anything import MapAnythingPredictor
            print("[Recon] MapAnything model — integration point (requires facebookresearch/map-anything)")
            return None
        except ImportError:
            print("[Recon] MapAnything not available")
            return None

    def _load_vggt(self):
        """Load VGGT model."""
        try:
            # VGGT integration point
            # import vggt
            print("[Recon] VGGT model — integration point (requires vggt package)")
            return None
        except ImportError:
            print("[Recon] VGGT not available")
            return None

    def _load_dust3r(self):
        """Load DUSt3R/MASt3R model."""
        try:
            # DUSt3R integration point
            # from dust3r.inference import inference
            print("[Recon] DUSt3R model — integration point (requires naver/dust3r)")
            return None
        except ImportError:
            print("[Recon] DUSt3R not available")
            return None

    def reconstruct(
        self,
        frame_paths: list[str],
        camera_intrinsics: Optional[dict] = None,
        initial_altitude: Optional[float] = None,
    ) -> ReconstructionResult:
        """
        Run 3D reconstruction on a set of frames.
        
        Args:
            frame_paths: List of paths to input frames
            camera_intrinsics: Optional {fx, fy, cx, cy} dict
            initial_altitude: Optional known flight altitude (meters) for scale
            
        Returns:
            ReconstructionResult with point cloud, camera poses, and scale
        """
        self.model = self._load_model()

        if self.model is not None:
            return self._run_model_inference(frame_paths, camera_intrinsics)

        # Demo / fallback: generate synthetic point cloud from frames
        print("[Recon] Running in demo mode — generating synthetic terrain point cloud")
        return self._generate_demo_reconstruction(frame_paths, initial_altitude)

    def _run_model_inference(
        self, frame_paths: list[str], intrinsics: Optional[dict]
    ) -> ReconstructionResult:
        """Run actual model inference. Placeholder for model-specific logic."""
        # This would be replaced with actual model calls:
        #
        # For MapAnything:
        #   result = self.model.predict(images, intrinsics=intrinsics)
        #   point_cloud = result.point_maps
        #   poses = result.camera_poses
        #
        # For VGGT:
        #   predictions = self.model.infer(images)
        #   point_cloud = predictions['world_points']
        #   poses = predictions['extrinsics']
        #
        raise NotImplementedError("Model inference requires GPU and model weights")

    def _generate_demo_reconstruction(
        self,
        frame_paths: list[str],
        altitude: Optional[float] = None,
    ) -> ReconstructionResult:
        """
        Generate a realistic synthetic terrain point cloud for demo purposes.
        
        Creates a terrain with hills, valleys, and some structural features
        to demonstrate the full pipeline visualization.
        """
        import cv2

        num_frames = len(frame_paths)
        alt = altitude or 50.0  # Default 50m altitude

        # --- Generate terrain point cloud ---
        grid_size = 200
        spread = alt * 2  # Ground coverage proportional to altitude

        x = np.linspace(-spread, spread, grid_size)
        y = np.linspace(-spread, spread, grid_size)
        xx, yy = np.meshgrid(x, y)

        # Multi-frequency terrain with hills and valleys
        zz = (
            3.0 * np.sin(xx * 0.05) * np.cos(yy * 0.05) +
            1.5 * np.sin(xx * 0.12 + 1.0) * np.cos(yy * 0.08 + 0.5) +
            0.8 * np.sin(xx * 0.25) * np.sin(yy * 0.25) +
            np.random.randn(grid_size, grid_size) * 0.3
        )

        # Add some "building" blocks
        for bx, by, bw, bh in [
            (30, 20, 8, 12), (-40, 30, 10, 8), (10, -35, 6, 15), (-25, -20, 12, 10)
        ]:
            mask = (np.abs(xx - bx) < bw / 2) & (np.abs(yy - by) < bh / 2)
            zz[mask] = np.max(zz) + np.random.uniform(5, 15)

        points = np.stack([xx.ravel(), yy.ravel(), zz.ravel()], axis=1)

        # Add some random scatter for realism
        num_scatter = 5000
        scatter_pts = np.random.randn(num_scatter, 3) * [spread * 0.8, spread * 0.8, 2.0]
        scatter_pts[:, 2] += np.interp(
            scatter_pts[:, 0], x, zz[grid_size // 2, :]
        )
        points = np.vstack([points, scatter_pts])

        # --- Colors from frame sampling ---
        colors = np.zeros((len(points), 3), dtype=np.uint8)

        # Sample colors from actual frame images
        if frame_paths:
            sample_frame = cv2.imread(frame_paths[len(frame_paths) // 2])
            if sample_frame is not None:
                fh, fw = sample_frame.shape[:2]
                # Map point XY to frame pixel coordinates
                px = ((points[:, 0] - points[:, 0].min()) /
                      (points[:, 0].max() - points[:, 0].min()) * (fw - 1)).astype(int)
                py = ((points[:, 1] - points[:, 1].min()) /
                      (points[:, 1].max() - points[:, 1].min()) * (fh - 1)).astype(int)
                px = np.clip(px, 0, fw - 1)
                py = np.clip(py, 0, fh - 1)
                colors = sample_frame[py, px, ::-1]  # BGR → RGB
            else:
                # Terrain-like colors
                norm_z = (points[:, 2] - points[:, 2].min()) / (points[:, 2].max() - points[:, 2].min() + 1e-8)
                colors[:, 0] = (80 + 100 * (1 - norm_z)).astype(np.uint8)   # R
                colors[:, 1] = (120 + 80 * (1 - norm_z)).astype(np.uint8)   # G
                colors[:, 2] = (60 + 40 * norm_z).astype(np.uint8)          # B
        else:
            norm_z = (points[:, 2] - points[:, 2].min()) / (points[:, 2].max() - points[:, 2].min() + 1e-8)
            colors[:, 0] = (80 + 100 * (1 - norm_z)).astype(np.uint8)
            colors[:, 1] = (120 + 80 * (1 - norm_z)).astype(np.uint8)
            colors[:, 2] = (60 + 40 * norm_z).astype(np.uint8)

        # --- Camera poses along a flight path ---
        camera_poses = []
        for i in range(num_frames):
            t_frac = i / max(num_frames - 1, 1)
            angle = t_frac * 2 * np.pi * 0.8  # Partial orbit

            cam_x = spread * 0.6 * np.cos(angle)
            cam_y = spread * 0.6 * np.sin(angle)
            cam_z = alt

            # Simple downward-looking camera rotation
            R = np.eye(3)
            R[2, 2] = -1  # Flip Z to look down
            t = np.array([cam_x, cam_y, cam_z])

            camera_poses.append(CameraPose(
                frame_index=i,
                rotation=R,
                translation=t,
                focal_length=1000.0,
            ))

        point_cloud = PointCloud(
            points=points,
            colors=colors.astype(np.uint8),
            confidence=np.random.uniform(0.6, 1.0, len(points)).astype(np.float32),
        )

        return ReconstructionResult(
            point_cloud=point_cloud,
            camera_poses=camera_poses,
            scale_factor=1.0,
        )

    def save_point_cloud_ply(self, result: ReconstructionResult, output_path: str):
        """Save point cloud to PLY format."""
        pc = result.point_cloud
        n = len(pc.points)

        header = (
            "ply\n"
            "format ascii 1.0\n"
            f"element vertex {n}\n"
            "property float x\n"
            "property float y\n"
            "property float z\n"
            "property uchar red\n"
            "property uchar green\n"
            "property uchar blue\n"
            "end_header\n"
        )

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "w") as f:
            f.write(header)
            for i in range(n):
                x, y, z = pc.points[i]
                r, g, b = pc.colors[i]
                f.write(f"{x:.6f} {y:.6f} {z:.6f} {r} {g} {b}\n")

        print(f"[Recon] Saved PLY: {output_path} ({n} points)")

    def save_cameras_json(self, result: ReconstructionResult, output_path: str):
        """Save camera poses to JSON for the web viewer."""
        import json

        cameras = []
        for pose in result.camera_poses:
            cameras.append({
                "frame_index": pose.frame_index,
                "rotation": pose.rotation.tolist(),
                "translation": pose.translation.tolist(),
                "focal_length": pose.focal_length,
            })

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "w") as f:
            json.dump({"cameras": cameras, "scale": result.scale_factor}, f, indent=2)

        print(f"[Recon] Saved cameras: {output_path} ({len(cameras)} poses)")
