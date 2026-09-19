"""
test_integration_demo_e2e.py — DemoEngine end-to-end integration test.

Tests the full pipeline path from frame extraction through reconstruction
to PLY output using DemoEngine (synthetic, CPU-only, no GPU needed).

This test proves the pipeline plumbing works end-to-end.
It does NOT test reconstruction quality — DemoEngine output is explicitly synthetic.
"""

import os
import json
import tempfile
import numpy as np
import pytest
import cv2

from pipeline.engines import get_engine
from pipeline.engines.base import ReconstructionResult, PointCloud


# -----------------------------------------------------------------------
# Helper: write synthetic JPEG frames to a temp directory
# -----------------------------------------------------------------------

def _make_synthetic_frames(tmpdir: str, n: int = 6, size=(128, 128)) -> list:
    """Write N synthetic coloured frames. Returns list of file paths."""
    paths = []
    for i in range(n):
        # Vary colour per frame so frames look different (non-redundant)
        frame = np.zeros((*size, 3), dtype=np.uint8)
        frame[:, :, i % 3] = 128 + i * 10
        # Add a checkerboard pattern to ensure non-zero blur score
        frame[0::8, :] = 255
        frame[:, 0::8] = 255
        path = os.path.join(tmpdir, f"frame_{i:05d}.jpg")
        cv2.imwrite(path, frame)
        paths.append(path)
    return paths


# -----------------------------------------------------------------------
# DemoEngine E2E: validate_inputs → reconstruct → result structure
# -----------------------------------------------------------------------

class TestDemoEngineE2E:
    """DemoEngine end-to-end integration test. CPU-only, no model files needed."""

    def test_demo_engine_validate_inputs_empty_raises(self):
        engine = get_engine("demo")
        with pytest.raises(ValueError, match="No frames"):
            engine.validate_inputs([])

    def test_demo_engine_validate_inputs_missing_file_raises(self):
        engine = get_engine("demo")
        with pytest.raises(ValueError, match="not found"):
            engine.validate_inputs(["/nonexistent/frame_00000.jpg"])

    def test_demo_engine_reconstruct_returns_result(self, tmp_path):
        frames = _make_synthetic_frames(str(tmp_path), n=6)
        engine = get_engine("demo")
        engine.validate_inputs(frames)
        result = engine.reconstruct(frames, initial_altitude=50.0)

        assert isinstance(result, ReconstructionResult)
        assert result.point_cloud is not None
        assert isinstance(result.point_cloud, PointCloud)

    def test_demo_engine_point_cloud_shape(self, tmp_path):
        frames = _make_synthetic_frames(str(tmp_path), n=6)
        result = get_engine("demo").reconstruct(frames, initial_altitude=50.0)

        pc = result.point_cloud
        assert pc.points.ndim == 2 and pc.points.shape[1] == 3, "Points must be Nx3"
        assert len(pc.points) > 100, f"Expected >100 points, got {len(pc.points)}"

    def test_demo_engine_colors_shape(self, tmp_path):
        frames = _make_synthetic_frames(str(tmp_path), n=6)
        result = get_engine("demo").reconstruct(frames)

        pc = result.point_cloud
        assert pc.colors is not None
        assert pc.colors.shape == pc.points.shape, "Colors must match points shape"
        assert pc.colors.dtype == np.uint8

    def test_demo_engine_confidence_range(self, tmp_path):
        frames = _make_synthetic_frames(str(tmp_path), n=6)
        result = get_engine("demo").reconstruct(frames)

        pc = result.point_cloud
        assert pc.confidence is not None
        assert len(pc.confidence) == len(pc.points)
        assert pc.confidence.min() >= 0.0, "Confidence must be >= 0"
        assert pc.confidence.max() <= 1.0, "Confidence must be <= 1"

    def test_demo_engine_camera_poses_count(self, tmp_path):
        n = 6
        frames = _make_synthetic_frames(str(tmp_path), n=n)
        result = get_engine("demo").reconstruct(frames)

        assert len(result.camera_poses) == n, (
            f"Expected {n} camera poses, got {len(result.camera_poses)}"
        )

    def test_demo_engine_camera_pose_rotation_shape(self, tmp_path):
        frames = _make_synthetic_frames(str(tmp_path), n=4)
        result = get_engine("demo").reconstruct(frames)

        for pose in result.camera_poses:
            assert pose.rotation.shape == (3, 3), "Rotation must be 3x3"
            assert pose.translation.shape == (3,), "Translation must be 3-vector"

    def test_demo_engine_engine_name_labelled_correctly(self, tmp_path):
        frames = _make_synthetic_frames(str(tmp_path), n=4)
        result = get_engine("demo").reconstruct(frames)
        assert result.engine_name == "demo", (
            f"DemoEngine must label itself 'demo', got '{result.engine_name}'"
        )

    def test_demo_engine_ply_output_is_valid(self, tmp_path):
        """Verify PLY file can be written and has correct structure."""
        import sys
        sys.path.insert(0, str(tmp_path))

        frames = _make_synthetic_frames(str(tmp_path), n=4)
        result = get_engine("demo").reconstruct(frames)

        # Write PLY manually (same logic as process_flight.py)
        ply_path = str(tmp_path / "test_output.ply")
        _save_ply(result.point_cloud, ply_path)

        assert os.path.exists(ply_path), "PLY file was not created"
        with open(ply_path) as f:
            header = f.readline()
        assert "ply" in header.lower(), "PLY file must start with 'ply'"

        # Count vertex lines: header ends at end_header, then data
        with open(ply_path) as f:
            content = f.read()
        data_section = content.split("end_header\n", 1)
        assert len(data_section) == 2, "PLY must have end_header"
        vertex_lines = [l for l in data_section[1].strip().split("\n") if l.strip()]
        assert len(vertex_lines) == len(result.point_cloud.points), (
            f"PLY vertex count {len(vertex_lines)} != point count {len(result.point_cloud.points)}"
        )

    def test_demo_engine_cameras_json_output(self, tmp_path):
        """Verify camera_trajectory.json can be written and loaded."""
        frames = _make_synthetic_frames(str(tmp_path), n=4)
        result = get_engine("demo").reconstruct(frames)

        json_path = str(tmp_path / "camera_trajectory.json")
        _save_cameras_json(result, json_path)

        assert os.path.exists(json_path)
        with open(json_path) as f:
            data = json.load(f)

        assert "cameras" in data
        assert len(data["cameras"]) == len(result.camera_poses)
        assert "scale" in data
        # Each camera entry must have rotation and translation
        for cam in data["cameras"]:
            assert "rotation" in cam
            assert "translation" in cam
            assert "frame_index" in cam

    def test_demo_engine_cleanup_does_not_crash(self, tmp_path):
        """cleanup() must not crash even when torch is not available."""
        engine = get_engine("demo")
        engine.cleanup()  # Must not raise


# -----------------------------------------------------------------------
# PLY / JSON helpers (mirrors process_flight.py logic, kept here for isolation)
# -----------------------------------------------------------------------

def _save_ply(pc: PointCloud, path: str):
    n = len(pc.points)
    header = (
        "ply\nformat ascii 1.0\n"
        f"element vertex {n}\n"
        "property float x\nproperty float y\nproperty float z\n"
        "property uchar red\nproperty uchar green\nproperty uchar blue\n"
        "end_header\n"
    )
    with open(path, "w") as f:
        f.write(header)
        for i in range(n):
            x, y, z = pc.points[i]
            r, g, b = pc.colors[i]
            f.write(f"{x:.6f} {y:.6f} {z:.6f} {r} {g} {b}\n")


def _save_cameras_json(result: ReconstructionResult, path: str):
    cameras = []
    for pose in result.camera_poses:
        cameras.append({
            "frame_index": pose.frame_index,
            "rotation": pose.rotation.tolist(),
            "translation": pose.translation.tolist(),
            "focal_length": pose.focal_length,
        })
    with open(path, "w") as f:
        json.dump({"cameras": cameras, "scale": result.scale_factor}, f, indent=2)
