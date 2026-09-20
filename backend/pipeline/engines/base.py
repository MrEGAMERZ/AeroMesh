from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
import numpy as np

@dataclass
class CameraPose:
    """Estimated camera pose for a single frame."""
    frame_index: int
    rotation: np.ndarray       # 3x3
    translation: np.ndarray    # 3,
    focal_length: float = 1000.0
    timestamp_ms: Optional[float] = None

@dataclass 
class PointCloud:
    """Reconstructed 3D point cloud."""
    points: np.ndarray         # Nx3 float32
    colors: Optional[np.ndarray] = None      # Nx3 uint8 RGB
    confidence: Optional[np.ndarray] = None  # N float32 0..1
    normals: Optional[np.ndarray] = None     # Nx3

@dataclass
class ReconstructionResult:
    """Complete output of the reconstruction pipeline."""
    point_cloud: PointCloud
    camera_poses: list        # list[CameraPose]
    scale_factor: float = 1.0
    alignment_residual: Optional[float] = None  # meters — None if not computed
    engine_name: str = "unknown"
    runtime_seconds: float = 0.0
    gpu_memory_mb: Optional[float] = None
    diagnostics: dict = field(default_factory=dict)
    mesh_data: Optional[dict] = None  # Explicit mesh {"vertices": array, "triangles": array, "colors": array}

class BaseReconstructionEngine(ABC):
    """
    Abstract base class for 3D reconstruction engines.
    Defines the standard interface for pluggable reconstruction backends.
    """
    @abstractmethod
    def validate_inputs(self, frame_paths: list[str], telemetry=None) -> None:
        """Raise ValueError with a human-readable message if inputs are invalid."""

    @abstractmethod
    def reconstruct(
        self,
        frame_paths: list[str],
        camera_intrinsics: Optional[dict] = None,
        initial_altitude: Optional[float] = None,
    ) -> ReconstructionResult:
        """Run reconstruction. Returns ReconstructionResult."""

    def get_capabilities(self) -> dict:
        """Return dict of engine capabilities. Engines override as needed."""
        return {"requires_gpu": False, "metric_scale": False, "engine": "base"}

    def cleanup(self) -> None:
        """Release GPU resources after reconstruction. Call this after reconstruct()."""
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        try:
            import gc; gc.collect()
        except Exception:
            pass
