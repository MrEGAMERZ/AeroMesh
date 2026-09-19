"""
vggsfm.py — VGGSfM Reconstruction Engine

Wraps the VGGSfMRunner from the official VGGSfM repository.
When VGGSfM is not installed, falls back to DemoEngine clearly labelled as synthetic.

VGGSfM: https://github.com/facebookresearch/vggsfm
Install:  pip install vggsfm  (requires torch>=2.2, CUDA)

The engine works on any CUDA GPU — RTX 5060, RTX 3090, H200, or any other.
There are NO hard-coded GPU assumptions.
"""

import os
import time
import numpy as np
from pathlib import Path
from typing import Optional

from .base import (
    BaseReconstructionEngine,
    ReconstructionResult,
    PointCloud,
    CameraPose,
)


class VGGSfMEngine(BaseReconstructionEngine):
    """
    Reconstruction engine backed by VGGSfM (Facebook Research / Oxford VGG).

    VGGSfM is a feed-forward Structure-from-Motion model that jointly predicts
    camera poses and 3D point tracks. It handles limited-viewpoint inputs better
    than classical COLMAP on constrained single-pass aerial cases.

    When VGGSfM is not installed, falls back to DemoEngine with a clear warning.
    The fallback is NEVER silently claimed as a real reconstruction.
    """

    def __init__(self, model_name: str = "vggsfm"):
        self.model_name = model_name

    def get_capabilities(self) -> dict:
        return {
            "engine": self.model_name,
            "requires_gpu": True,
            "metric_scale": False,       # Up-to-scale; metric alignment needs telemetry
            "handles_single_pass": True,
            "confidence_output": True,
        }

    def validate_inputs(self, frame_paths: list, telemetry=None) -> None:
        if not frame_paths:
            raise ValueError(
                f"[{self.model_name}] No frame paths provided. "
                "Extract frames from the video before calling reconstruct()."
            )
        if len(frame_paths) < 3:
            raise ValueError(
                f"[{self.model_name}] Needs at least 3 frames, got {len(frame_paths)}. "
                "Try lowering blur_threshold or increasing target_fps in IngestConfig."
            )
        missing = [p for p in frame_paths if not os.path.exists(p)]
        if missing:
            raise ValueError(
                f"[{self.model_name}] {len(missing)} frame file(s) not found: {missing[:3]}"
            )
        try:
            import torch
            if not torch.cuda.is_available():
                raise ValueError(
                    f"[{self.model_name}] Requires a CUDA GPU. "
                    "torch.cuda.is_available() returned False. "
                    "Use get_engine('demo') for CPU-only environments."
                )
        except ImportError:
            raise ValueError(
                f"[{self.model_name}] Requires PyTorch with CUDA. "
                "Install: pip install torch --index-url https://download.pytorch.org/whl/cu121"
            )

    def reconstruct(
        self,
        frame_paths: list,
        camera_intrinsics: Optional[dict] = None,
        initial_altitude: Optional[float] = None,
    ) -> ReconstructionResult:
        """
        Run VGGSfM inference on the provided frames.

        Returns ReconstructionResult with:
          - point_cloud: 3D points, per-point confidence (normalised track visibility)
          - camera_poses: per-frame R and t matrices
          - engine_name: "vggsfm"
          - runtime_seconds: measured wall time
          - gpu_memory_mb: VRAM delta
          - diagnostics: num_tracks, avg_confidence, metric_scale note
        """
        self.validate_inputs(frame_paths)

        import torch
        mem_before = torch.cuda.memory_allocated() // 1024 ** 2
        t0 = time.time()

        try:
            result = self._run_vggsfm(frame_paths, camera_intrinsics)
        except ImportError as e:
            print(
                f"\n[Warning] VGGSfM not installed: {e}\n"
                "  Install: pip install vggsfm\n"
                "  Falling back to DemoEngine (SYNTHETIC — not a real reconstruction).\n"
            )
            result = self._demo_fallback(frame_paths, camera_intrinsics, initial_altitude)
        except Exception as e:
            print(
                f"\n[Warning] VGGSfM inference failed: {type(e).__name__}: {e}\n"
                "  Falling back to DemoEngine (SYNTHETIC — not a real reconstruction).\n"
            )
            result = self._demo_fallback(frame_paths, camera_intrinsics, initial_altitude)
        finally:
            self.cleanup()

        mem_after = torch.cuda.memory_allocated() // 1024 ** 2
        result.gpu_memory_mb = max(0, mem_after - mem_before)
        result.runtime_seconds = time.time() - t0
        result.engine_name = self.model_name
        return result

    # ------------------------------------------------------------------
    def _run_vggsfm(self, frame_paths: list, camera_intrinsics: Optional[dict]) -> ReconstructionResult:
        """Run actual VGGSfM inference. Raises ImportError if library not installed."""
        import torch
        from vggsfm.runners.runner import VGGSfMRunner
        from omegaconf import OmegaConf

        device = "cuda"
        num_frames = len(frame_paths)
        print(f"[VGGSfM] Loading {num_frames} frames on {torch.cuda.get_device_name(0)}...")

        images, orig_images = _load_frames_as_tensor(frame_paths, device)

        cfg = OmegaConf.create({
            "query_frame_num": min(3, num_frames),
            "max_query_pts": 2048,
            "max_1st_frame_num": 192,
            "max_frame_num": min(num_frames, 64),  # cap for VRAM safety on RTX 5060
            "mixed_precision": "bf16",
            "dense_depth": False,
            "viz_visualize": False,
            "gr_visualize": False,
            "make_reproj_video": False,
            "save_to_disk": False,
            "resume_ckpt": None,
            "vggsfm_model": "vggsfm_v2",
        })

        print("[VGGSfM] Initialising runner...")
        runner = VGGSfMRunner(cfg)
        runner.vggsfm_model.eval()

        print("[VGGSfM] Running sparse reconstruction...")
        with torch.no_grad():
            predictions = runner.run(
                images=images,
                image_paths=frame_paths,
                seq_name="aeromesh_flight",
            )

        return _parse_vggsfm_predictions(predictions, frame_paths)

    def _demo_fallback(self, frame_paths, camera_intrinsics, initial_altitude) -> ReconstructionResult:
        from .demo import DemoEngine
        result = DemoEngine().reconstruct(frame_paths, camera_intrinsics, initial_altitude)
        result.engine_name = "demo_fallback"
        result.diagnostics["warning"] = (
            "SYNTHETIC DATA — VGGSfM was unavailable. "
            "This is NOT a real reconstruction. Install VGGSfM for real results."
        )
        return result


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------

def _load_frames_as_tensor(frame_paths: list, device: str):
    """Load frames → (T, 3, H, W) float32 tensor in [0,1] on `device`."""
    import torch, cv2

    target_h, target_w = None, None
    tensors = []
    orig_images = {}

    for path in frame_paths:
        bgr = cv2.imread(path)
        if bgr is None:
            raise RuntimeError(f"[VGGSfM] Could not read frame: {path}")
        if target_h is None:
            target_h, target_w = bgr.shape[:2]
        elif bgr.shape[:2] != (target_h, target_w):
            bgr = cv2.resize(bgr, (target_w, target_h))

        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        orig_images[Path(path).name] = rgb

        t = torch.from_numpy(rgb).float() / 255.0  # H x W x 3
        tensors.append(t.permute(2, 0, 1))          # 3 x H x W

    return torch.stack(tensors).to(device), orig_images  # T x 3 x H x W


def _parse_vggsfm_predictions(predictions: dict, frame_paths: list) -> ReconstructionResult:
    """
    Convert VGGSfMRunner predictions dict → ReconstructionResult.

    Keys used:
      predictions["extrinsics"]   (T, 3, 4) or (B, T, 3, 4) world-to-cam
      predictions["intrinsics"]   (T, 3, 3)
      predictions["points3D"]     (N, 3) triangulated world points
      predictions["track_vis"]    (N,)  per-point visibility count (optional)
    """
    extrinsics = predictions.get("extrinsics")
    intrinsics  = predictions.get("intrinsics")
    points3d    = predictions.get("points3D")
    track_vis   = predictions.get("track_vis")

    # Strip batch dimension if present
    def _to_np(t):
        if t is None:
            return None
        arr = t.cpu().numpy() if hasattr(t, "cpu") else np.array(t)
        return arr

    ext_np = _to_np(extrinsics)
    int_np = _to_np(intrinsics)
    pts_np = _to_np(points3d)
    vis_np = _to_np(track_vis)

    if ext_np is not None and ext_np.ndim == 4:
        ext_np = ext_np[0]
    if int_np is not None and int_np.ndim == 4:
        int_np = int_np[0]

    # Build camera poses
    camera_poses = []
    if ext_np is not None:
        for i, ext in enumerate(ext_np):
            R = ext[:3, :3]
            t = ext[:3, 3]
            fl = float(int_np[i, 0, 0]) if int_np is not None else 1000.0
            camera_poses.append(CameraPose(
                frame_index=i,
                rotation=R,
                translation=t,
                focal_length=fl,
            ))

    # Build point cloud
    if pts_np is not None and len(pts_np) > 0:
        if vis_np is not None and len(vis_np) == len(pts_np):
            max_vis = float(vis_np.max()) if vis_np.max() > 0 else 1.0
            confidence = (vis_np / max_vis).astype(np.float32)
        else:
            confidence = np.ones(len(pts_np), dtype=np.float32)

        colors = np.full((len(pts_np), 3), 180, dtype=np.uint8)  # neutral grey placeholder
        point_cloud = PointCloud(
            points=pts_np.astype(np.float32),
            colors=colors,
            confidence=confidence,
        )
        num_tracks = len(pts_np)
        avg_conf = float(np.mean(confidence))
    else:
        point_cloud = PointCloud(
            points=np.zeros((0, 3), dtype=np.float32),
            colors=np.zeros((0, 3), dtype=np.uint8),
            confidence=np.zeros(0, dtype=np.float32),
        )
        num_tracks = 0
        avg_conf = 0.0

    diagnostics = {
        "num_tracks": num_tracks,
        "num_camera_poses": len(camera_poses),
        "avg_confidence": round(avg_conf, 3),
        "metric_scale": False,
        "note": (
            "Scale is relative (up-to-scale). "
            "Metric alignment requires GPS/IMU telemetry fusion via TrajectoryAligner. "
            "Confidence is normalised track visibility — not an absolute accuracy measure."
        ),
    }

    return ReconstructionResult(
        point_cloud=point_cloud,
        camera_poses=camera_poses,
        scale_factor=1.0,
        alignment_residual=None,
        engine_name="vggsfm",
        diagnostics=diagnostics,
    )
