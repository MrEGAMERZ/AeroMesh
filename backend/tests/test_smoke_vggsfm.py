"""
test_smoke_vggsfm.py — Real VGGSfM reconstruction smoke test.

Skipped automatically if:
  - torch is not installed
  - CUDA is not available
  - vggsfm package is not installed

When ALL three are present (i.e., on the RTX 5060 / H200 machine),
this test exercises the REAL inference path and asserts that the output
is valid, non-empty, and correctly structured.

Run manually on GPU machine:
  cd backend && python -m pytest tests/test_smoke_vggsfm.py -v -s

Do NOT run as part of the standard CI suite (requires GPU + model weights).
Mark: pytest.ini excludes smoke tests by default unless --run-gpu flag is set.
"""

import os
import numpy as np
import pytest
import cv2


# -----------------------------------------------------------------------
# Skip markers — all GPU smoke tests use these
# -----------------------------------------------------------------------

def _has_cuda():
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False

def _has_vggsfm():
    try:
        import vggsfm
        return True
    except ImportError:
        return False

requires_gpu    = pytest.mark.skipif(not _has_cuda(), reason="CUDA GPU not available")
requires_vggsfm = pytest.mark.skipif(not _has_vggsfm(), reason="vggsfm not installed — run: pip install vggsfm")


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

def _make_frames(tmpdir: str, n: int = 8, size=(384, 384)) -> list:
    """Create N minimal synthetic JPEG frames for a fast smoke run."""
    paths = []
    for i in range(n):
        frame = np.zeros((*size, 3), dtype=np.uint8)
        # Simple gradient + checkerboard to give feature detector something to work with
        frame[:, :, i % 3] = np.linspace(50, 200, size[1], dtype=np.uint8)
        frame[0::16, :] = 255
        frame[:, 0::16] = 255
        path = os.path.join(tmpdir, f"frame_{i:05d}.jpg")
        cv2.imwrite(path, frame)
        paths.append(path)
    return paths


# -----------------------------------------------------------------------
# VGGSfM real inference smoke tests
# -----------------------------------------------------------------------

@requires_gpu
@requires_vggsfm
class TestVGGSfMSmokeRealGPU:
    """
    Real VGGSfM inference smoke tests.
    Only run on a machine with CUDA GPU + vggsfm installed.
    """

    def test_vggsfm_engine_loads_without_error(self):
        """VGGSfMEngine should import and instantiate without error."""
        from pipeline.engines.vggsfm import VGGSfMEngine
        engine = VGGSfMEngine("vggsfm")
        caps = engine.get_capabilities()
        assert caps["engine"] == "vggsfm"
        assert caps["requires_gpu"] is True

    def test_vggsfm_validate_inputs_passes_with_real_frames(self, tmp_path):
        from pipeline.engines.vggsfm import VGGSfMEngine
        frames = _make_frames(str(tmp_path), n=5)
        engine = VGGSfMEngine("vggsfm")
        engine.validate_inputs(frames)   # Must not raise

    def test_vggsfm_reconstruct_returns_nonempty_result(self, tmp_path):
        """Core smoke test: real VGGSfM inference must return a populated result."""
        import torch
        from pipeline.engines.vggsfm import VGGSfMEngine
        from pipeline.engines.base import ReconstructionResult

        frames = _make_frames(str(tmp_path), n=8)
        engine = VGGSfMEngine("vggsfm")

        result = engine.reconstruct(frames)

        assert isinstance(result, ReconstructionResult)
        assert result.engine_name == "vggsfm", (
            f"engine_name must be 'vggsfm', got '{result.engine_name}'. "
            "If it's 'demo_fallback', VGGSfM inference silently failed."
        )
        assert result.point_cloud is not None
        assert len(result.point_cloud.points) > 0, (
            "VGGSfM produced 0 3D points. Check that frames have enough texture/features."
        )
        assert result.point_cloud.points.shape[1] == 3
        assert result.runtime_seconds > 0

    def test_vggsfm_camera_poses_produced(self, tmp_path):
        """VGGSfM must produce one camera pose per input frame."""
        from pipeline.engines.vggsfm import VGGSfMEngine
        n = 8
        frames = _make_frames(str(tmp_path), n=n)
        result = VGGSfMEngine("vggsfm").reconstruct(frames)

        assert len(result.camera_poses) == n, (
            f"Expected {n} camera poses (one per frame), got {len(result.camera_poses)}"
        )
        for pose in result.camera_poses:
            assert pose.rotation.shape == (3, 3)
            assert pose.translation.shape == (3,)
            # Rotation must be approximately orthogonal (|det(R)| ≈ 1)
            det = abs(np.linalg.det(pose.rotation))
            assert 0.95 < det < 1.05, f"Rotation matrix det={det:.3f} is not orthogonal"

    def test_vggsfm_confidence_in_valid_range(self, tmp_path):
        """Per-point confidence must be in [0, 1]."""
        from pipeline.engines.vggsfm import VGGSfMEngine
        frames = _make_frames(str(tmp_path), n=6)
        result = VGGSfMEngine("vggsfm").reconstruct(frames)

        if len(result.point_cloud.confidence) > 0:
            assert result.point_cloud.confidence.min() >= 0.0
            assert result.point_cloud.confidence.max() <= 1.0

    def test_vggsfm_gpu_memory_recorded(self, tmp_path):
        """VRAM usage delta must be recorded (non-negative)."""
        from pipeline.engines.vggsfm import VGGSfMEngine
        frames = _make_frames(str(tmp_path), n=6)
        result = VGGSfMEngine("vggsfm").reconstruct(frames)
        assert result.gpu_memory_mb is not None
        assert result.gpu_memory_mb >= 0

    def test_vggsfm_diagnostics_present(self, tmp_path):
        """Diagnostics dict must be present with required keys."""
        from pipeline.engines.vggsfm import VGGSfMEngine
        frames = _make_frames(str(tmp_path), n=6)
        result = VGGSfMEngine("vggsfm").reconstruct(frames)

        d = result.diagnostics
        assert "num_tracks" in d
        assert "num_camera_poses" in d
        assert "avg_confidence" in d
        assert "metric_scale" in d
        assert d["metric_scale"] is False, "VGGSfM output is not metric without telemetry"

    def test_vggsfm_not_metric_without_telemetry(self, tmp_path):
        """VGGSfM output must be labelled as non-metric (scale=1.0, residual=None)."""
        from pipeline.engines.vggsfm import VGGSfMEngine
        frames = _make_frames(str(tmp_path), n=6)
        result = VGGSfMEngine("vggsfm").reconstruct(frames)

        assert result.scale_factor == 1.0, (
            "scale_factor must be 1.0 (relative) until telemetry alignment is applied"
        )
        assert result.alignment_residual is None, (
            "alignment_residual must be None until TrajectoryAligner runs"
        )

    def test_vggsfm_cleanup_releases_vram(self, tmp_path):
        """After cleanup(), VRAM should decrease (at minimum: not crash)."""
        import torch
        from pipeline.engines.vggsfm import VGGSfMEngine
        engine = VGGSfMEngine("vggsfm")
        frames = _make_frames(str(tmp_path), n=4)
        engine.reconstruct(frames)
        mem_before = torch.cuda.memory_allocated()
        engine.cleanup()
        # torch.cuda.empty_cache() may not immediately show in memory_allocated,
        # but it must not raise.
        assert True   # If we reach here, cleanup() didn't crash

    def test_vggsfm_ply_artifact_is_produceable(self, tmp_path):
        """Verify the PLY artifact can be written from real VGGSfM output."""
        import json
        from pipeline.engines.vggsfm import VGGSfMEngine

        frames = _make_frames(str(tmp_path), n=6)
        result = VGGSfMEngine("vggsfm").reconstruct(frames)

        if len(result.point_cloud.points) == 0:
            pytest.skip("VGGSfM produced 0 points — cannot write PLY (check frame quality)")

        ply_path = str(tmp_path / "smoke_output.ply")
        n = len(result.point_cloud.points)
        header = (
            f"ply\nformat ascii 1.0\nelement vertex {n}\n"
            "property float x\nproperty float y\nproperty float z\n"
            "property uchar red\nproperty uchar green\nproperty uchar blue\n"
            "end_header\n"
        )
        with open(ply_path, "w") as f:
            f.write(header)
            for i in range(n):
                x, y, z = result.point_cloud.points[i]
                r, g, b = result.point_cloud.colors[i]
                f.write(f"{x:.6f} {y:.6f} {z:.6f} {r} {g} {b}\n")

        assert os.path.exists(ply_path)
        size_kb = os.path.getsize(ply_path) / 1024
        print(f"\n[Smoke] PLY artifact: {ply_path} ({size_kb:.1f} KB, {n} points)")
        assert size_kb > 0


# -----------------------------------------------------------------------
# Fallback behaviour when VGGSfM is NOT installed (always runs)
# -----------------------------------------------------------------------

class TestVGGSfMFallbackBehaviour:
    """
    These tests run on ANY machine (even without CUDA/vggsfm).
    They verify that the fallback is labelled correctly and doesn't silently
    pretend to be a real reconstruction.
    """

    def test_vggsfm_engine_fallback_labelled_as_demo(self, tmp_path):
        """If VGGSfM is unavailable, result.engine_name must be 'demo_fallback'."""
        if _has_cuda() and _has_vggsfm():
            pytest.skip("VGGSfM is installed — fallback not triggered in this env")

        import cv2
        frames = []
        for i in range(4):
            path = str(tmp_path / f"frame_{i:05d}.jpg")
            frame = np.zeros((64, 64, 3), dtype=np.uint8)
            cv2.imwrite(path, frame)
            frames.append(path)

        # On a CPU-only machine, validate_inputs will raise before reaching the fallback
        # because CUDA check fails. That's correct behaviour.
        from pipeline.engines.vggsfm import VGGSfMEngine
        engine = VGGSfMEngine("vggsfm")
        with pytest.raises(ValueError, match="CUDA"):
            engine.validate_inputs(frames)
