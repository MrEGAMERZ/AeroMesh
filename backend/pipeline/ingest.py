"""
ingest.py — Frame Extraction & Blur Detection Module

Extracts frames from drone video at adaptive intervals, filters out
blurry/redundant frames using Laplacian variance, and prepares a
clean frame set for 3D reconstruction.
"""

import os
import cv2
import numpy as np
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FrameMetadata:
    """Metadata for a single extracted frame."""
    index: int
    timestamp_ms: float
    filepath: str
    blur_score: float
    is_valid: bool
    width: int
    height: int


@dataclass
class IngestConfig:
    """Configuration for video ingestion."""
    target_fps: float = 2.0                 # Frames per second to extract
    blur_threshold: float = 100.0           # Laplacian variance threshold (below = blurry)
    min_frame_interval_ms: float = 200.0    # Minimum interval between frames
    max_frames: int = 500                   # Maximum frames to extract
    output_format: str = "png"              # Output frame format
    resize_max_dim: Optional[int] = None    # Optional resize (longest edge)
    adaptive_sampling: bool = True          # Adjust extraction rate based on motion


class VideoIngestor:
    """
    Extracts and filters frames from drone video footage.
    
    Uses Laplacian variance for blur detection and adaptive sampling
    to balance coverage vs redundancy for single-pass reconstruction.
    """

    def __init__(self, config: Optional[IngestConfig] = None):
        self.config = config or IngestConfig()
        self.frames: list[FrameMetadata] = []

    def compute_blur_score(self, frame: np.ndarray) -> float:
        """
        Compute Laplacian variance as a sharpness/blur metric.
        Higher values = sharper image. Below threshold = blurry.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        return float(laplacian.var())

    def compute_frame_difference(self, frame_a: np.ndarray, frame_b: np.ndarray) -> float:
        """
        Compute normalized structural difference between two frames.
        Used for adaptive sampling — skip near-identical consecutive frames.
        """
        gray_a = cv2.cvtColor(frame_a, cv2.COLOR_BGR2GRAY)
        gray_b = cv2.cvtColor(frame_b, cv2.COLOR_BGR2GRAY)

        # Resize to small thumbnails for fast comparison
        thumb_size = (128, 128)
        thumb_a = cv2.resize(gray_a, thumb_size)
        thumb_b = cv2.resize(gray_b, thumb_size)

        diff = np.abs(thumb_a.astype(float) - thumb_b.astype(float))
        return float(diff.mean()) / 255.0

    def resize_frame(self, frame: np.ndarray) -> np.ndarray:
        """Optionally resize frame to max dimension while preserving aspect ratio."""
        if self.config.resize_max_dim is None:
            return frame

        h, w = frame.shape[:2]
        max_dim = max(h, w)
        if max_dim <= self.config.resize_max_dim:
            return frame

        scale = self.config.resize_max_dim / max_dim
        new_w = int(w * scale)
        new_h = int(h * scale)
        return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)

    def extract_frames(self, video_path: str, output_dir: str) -> list[FrameMetadata]:
        """
        Extract frames from a video file with blur filtering and adaptive sampling.
        
        Args:
            video_path: Path to the input drone video file.
            output_dir: Directory to save extracted frames.
            
        Returns:
            List of FrameMetadata for each valid extracted frame.
        """
        video_path = str(Path(video_path).resolve())
        output_dir = str(Path(output_dir).resolve())
        os.makedirs(output_dir, exist_ok=True)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video file: {video_path}")

        video_fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_s = total_frames / video_fps if video_fps > 0 else 0

        # Compute frame interval based on target FPS
        frame_interval = max(1, int(video_fps / self.config.target_fps))

        print(f"[Ingest] Video: {video_path}")
        print(f"[Ingest] FPS: {video_fps:.1f}, Total frames: {total_frames}, Duration: {duration_s:.1f}s")
        print(f"[Ingest] Extracting every {frame_interval} frames (target {self.config.target_fps} fps)")

        self.frames = []
        prev_frame = None
        frame_idx = 0
        extracted_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Skip frames based on interval
            if frame_idx % frame_interval != 0:
                frame_idx += 1
                continue

            # Check extraction limit
            if extracted_count >= self.config.max_frames:
                print(f"[Ingest] Reached max frame limit ({self.config.max_frames})")
                break

            timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)

            # Compute blur score
            blur_score = self.compute_blur_score(frame)
            is_sharp = blur_score >= self.config.blur_threshold

            # Adaptive sampling: skip near-identical frames
            is_different = True
            if self.config.adaptive_sampling and prev_frame is not None:
                diff = self.compute_frame_difference(frame, prev_frame)
                is_different = diff > 0.02  # 2% change threshold

            is_valid = is_sharp and is_different

            if is_valid:
                # Resize if configured
                save_frame = self.resize_frame(frame)

                # Save frame
                filename = f"frame_{extracted_count:05d}.{self.config.output_format}"
                filepath = os.path.join(output_dir, filename)
                cv2.imwrite(filepath, save_frame)

                h, w = save_frame.shape[:2]
                meta = FrameMetadata(
                    index=extracted_count,
                    timestamp_ms=timestamp_ms,
                    filepath=filepath,
                    blur_score=blur_score,
                    is_valid=True,
                    width=w,
                    height=h,
                )
                self.frames.append(meta)
                prev_frame = frame.copy()
                extracted_count += 1

            frame_idx += 1

        cap.release()
        print(f"[Ingest] Extracted {len(self.frames)} valid frames from {frame_idx} total")
        return self.frames

    def get_frame_paths(self) -> list[str]:
        """Return list of file paths for all valid extracted frames."""
        return [f.filepath for f in self.frames]

    def get_timestamps(self) -> list[float]:
        """Return list of timestamps (ms) for all valid extracted frames."""
        return [f.timestamp_ms for f in self.frames]

    def summary(self) -> dict:
        """Return a summary of the ingestion results."""
        if not self.frames:
            return {"status": "no frames extracted"}

        blur_scores = [f.blur_score for f in self.frames]
        return {
            "total_frames": len(self.frames),
            "avg_blur_score": float(np.mean(blur_scores)),
            "min_blur_score": float(np.min(blur_scores)),
            "max_blur_score": float(np.max(blur_scores)),
            "resolution": f"{self.frames[0].width}x{self.frames[0].height}",
            "time_span_s": (self.frames[-1].timestamp_ms - self.frames[0].timestamp_ms) / 1000.0,
        }
