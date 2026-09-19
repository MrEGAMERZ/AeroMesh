import pytest
import os
import tempfile
import numpy as np
from unittest.mock import patch, MagicMock

import sys
try:
    import cv2
except ImportError:
    pass

from pipeline.ingest import VideoIngestor, IngestConfig, FrameMetadata

def test_blur_score_computation():
    # Skip if cv2 is mocked (no real OpenCV installed)
    try:
        import cv2 as _cv2_real
        if not hasattr(_cv2_real, 'GaussianBlur'):
            pytest.skip("cv2 is mocked")
    except ImportError:
        pytest.skip("cv2 not installed")

    ingestor = VideoIngestor(IngestConfig())

    # compute_blur_score calls cv2.cvtColor(frame, COLOR_BGR2GRAY)
    # so input must be a 3-channel BGR image, not grayscale
    sharp_bgr = np.zeros((100, 100, 3), dtype=np.uint8)
    sharp_bgr[0:50, 0:50] = 255   # high-contrast checkerboard in BGR
    sharp_bgr[50:100, 50:100] = 255

    # Apply heavy Gaussian blur to create a blurry version
    blurry_bgr = cv2.GaussianBlur(sharp_bgr, (21, 21), 0)

    score_sharp = ingestor.compute_blur_score(sharp_bgr)
    score_blurry = ingestor.compute_blur_score(blurry_bgr)

    assert score_sharp > score_blurry, (
        f"Expected sharp score ({score_sharp:.1f}) > blurry score ({score_blurry:.1f})"
    )


@patch.object(VideoIngestor, 'compute_blur_score', return_value=100.0)
@patch.object(VideoIngestor, 'compute_frame_difference', return_value=1.0)
def test_frame_interval_calculation(mock_diff, mock_blur):
    # With target_fps=2.0 and video FPS=30, the frame interval should be 15.
    config = IngestConfig(target_fps=2.0)
    ingestor = VideoIngestor(config)
    with patch('cv2.VideoCapture') as mock_vc:
        mock_cap = MagicMock()
        mock_vc.return_value = mock_cap
        mock_cap.isOpened.return_value = True
        mock_cap.get.side_effect = lambda prop: 30.0 if prop == cv2.CAP_PROP_FPS else 1000.0
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        read_count = 0
        def read_side_effect():
            nonlocal read_count
            read_count += 1
            if read_count > 45: return (False, None)
            return (True, frame)
        mock_cap.read.side_effect = read_side_effect
        with tempfile.TemporaryDirectory() as tmpdir:
            metadata = ingestor.extract_frames("fake.mp4", tmpdir)
            # 45 frames read. Interval 15 means it extracts at frame 0, 15, 30.
            # So total 3 frames should be extracted.
            assert len(metadata) == 3

@patch.object(VideoIngestor, 'compute_blur_score', return_value=100.0)
@patch.object(VideoIngestor, 'compute_frame_difference', return_value=1.0)
def test_max_frames_limit(mock_diff, mock_blur):
    config = IngestConfig(max_frames=5, target_fps=30.0)
    ingestor = VideoIngestor(config)
    with patch('cv2.VideoCapture') as mock_vc:
        mock_cap = MagicMock()
        mock_vc.return_value = mock_cap
        mock_cap.isOpened.return_value = True
        mock_cap.get.side_effect = lambda prop: 30.0 if prop == cv2.CAP_PROP_FPS else 1000.0
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        read_count = 0
        def read_side_effect():
            nonlocal read_count
            read_count += 1
            if read_count > 100: return (False, None)
            return (True, frame)
        mock_cap.read.side_effect = read_side_effect
        with tempfile.TemporaryDirectory() as tmpdir:
            metadata = ingestor.extract_frames("fake.mp4", tmpdir)
            assert len(metadata) == 5

def test_invalid_video():
    ingestor = VideoIngestor(IngestConfig())
    with tempfile.TemporaryDirectory() as tmpdir:
        with pytest.raises((RuntimeError, Exception)):
            ingestor.extract_frames("nonexistent_video.mp4", tmpdir)

@patch.object(VideoIngestor, 'compute_blur_score', return_value=100.0)
@patch.object(VideoIngestor, 'compute_frame_difference', return_value=1.0)
def test_summary_output(mock_diff, mock_blur):
    config = IngestConfig(max_frames=2, target_fps=30.0)
    ingestor = VideoIngestor(config)
    with patch('cv2.VideoCapture') as mock_vc:
        mock_cap = MagicMock()
        mock_vc.return_value = mock_cap
        mock_cap.isOpened.return_value = True
        mock_cap.get.return_value = 30.0
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        read_count = 0
        def read_side_effect():
            nonlocal read_count
            read_count += 1
            if read_count > 2: return (False, None)
            return (True, frame)
        mock_cap.read.side_effect = read_side_effect
        with tempfile.TemporaryDirectory() as tmpdir:
            ingestor.extract_frames("fake.mp4", tmpdir)
            summary = ingestor.summary()
            assert "total_frames" in summary
            assert "avg_blur_score" in summary
            assert "resolution" in summary
            assert summary["total_frames"] == 2
