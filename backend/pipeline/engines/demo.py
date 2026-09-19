import numpy as np
from typing import Optional
from .base import BaseReconstructionEngine, ReconstructionResult, PointCloud, CameraPose

class DemoEngine(BaseReconstructionEngine):
    """
    Fallback demo engine. Generates a synthetic terrain point cloud seeded with
    colours from the actual video frames. Does not require GPU.
    """

    def get_capabilities(self) -> dict:
        return {"requires_gpu": False, "metric_scale": False, "engine": "demo"}

    def validate_inputs(self, frame_paths: list, telemetry=None) -> None:
        """Validate that frames are provided and all paths exist on disk."""
        if not frame_paths:
            raise ValueError("No frames provided for DemoEngine reconstruction.")
        missing = [p for p in frame_paths if not __import__('os').path.exists(p)]
        if missing:
            raise ValueError(
                f"[DemoEngine] {len(missing)} frame file(s) not found: {missing[:3]}"
            )


    def reconstruct(
        self,
        frame_paths: list[str],
        camera_intrinsics: Optional[dict] = None,
        initial_altitude: Optional[float] = None,
    ) -> ReconstructionResult:
        """Run synthetic demo reconstruction."""
        import cv2
        self.validate_inputs(frame_paths)
        
        num_frames = len(frame_paths)
        alt = initial_altitude or 50.0  # Default 50m altitude

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
            points=points.astype(np.float32),
            colors=colors.astype(np.uint8),
            confidence=np.random.uniform(0.6, 1.0, len(points)).astype(np.float32),
        )

        result = ReconstructionResult(
            point_cloud=point_cloud,
            camera_poses=camera_poses,
            scale_factor=1.0,
            engine_name="demo"
        )
        
        self.cleanup()
        return result
