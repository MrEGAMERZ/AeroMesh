"""
dynamic_masking.py — SAM2 Dynamic Object Masking

Masks dynamic objects (vehicles, pedestrians, animals) in video frames
before 3D reconstruction to prevent geometry corruption from moving objects.

Uses SAM2 (Segment Anything Model 2) for video-consistent segmentation,
with fallback to frame-difference-based motion detection.
"""

import os
import cv2
import numpy as np
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


@dataclass
class MaskResult:
    """Result of masking a single frame."""
    frame_index: int
    original_path: str
    masked_path: str
    mask_path: str
    dynamic_pixel_ratio: float      # Fraction of frame masked as dynamic
    num_objects_detected: int


@dataclass
class MaskingConfig:
    """Configuration for dynamic object masking."""
    method: str = "motion_diff"     # "sam2" or "motion_diff" (fallback)
    motion_threshold: float = 30.0  # Pixel difference threshold for motion detection
    min_contour_area: int = 500     # Minimum contour area to qualify as a dynamic object
    dilate_kernel_size: int = 15    # Dilation to expand masks around detected objects
    sam2_checkpoint: Optional[str] = None
    sam2_config: Optional[str] = None
    device: str = "cuda"


class DynamicObjectMasker:
    """
    Detects and masks dynamic objects in drone video frames.
    
    Primary: SAM2-based video segmentation (when available)
    Fallback: Frame-difference motion detection with contour filtering
    """

    def __init__(self, config: Optional[MaskingConfig] = None):
        self.config = config or MaskingConfig()
        self.sam2_predictor = None

    def _init_sam2(self):
        """Initialize SAM2 model if available."""
        try:
            from sam2.build_sam import build_sam2_video_predictor

            if self.config.sam2_checkpoint and self.config.sam2_config:
                self.sam2_predictor = build_sam2_video_predictor(
                    self.config.sam2_config,
                    self.config.sam2_checkpoint,
                    device=self.config.device,
                )
                print("[Masking] SAM2 video predictor initialized")
            else:
                print("[Masking] SAM2 checkpoint/config not provided, using fallback")
        except ImportError:
            print("[Masking] SAM2 not installed, using motion-difference fallback")

    def mask_frames_motion_diff(
        self, frame_paths: list[str], output_dir: str
    ) -> list[MaskResult]:
        """
        Fallback masking using frame-to-frame motion detection.
        
        Computes absolute difference between consecutive frames,
        thresholds to find moving regions, and generates binary masks.
        """
        os.makedirs(output_dir, exist_ok=True)
        mask_dir = os.path.join(output_dir, "masks")
        masked_dir = os.path.join(output_dir, "masked_frames")
        os.makedirs(mask_dir, exist_ok=True)
        os.makedirs(masked_dir, exist_ok=True)

        results = []
        prev_gray = None

        for i, fpath in enumerate(frame_paths):
            frame = cv2.imread(fpath)
            if frame is None:
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.GaussianBlur(gray, (21, 21), 0)

            h, w = frame.shape[:2]
            mask = np.zeros((h, w), dtype=np.uint8)
            num_objects = 0

            if prev_gray is not None:
                # Absolute difference
                diff = cv2.absdiff(prev_gray, gray)
                _, thresh = cv2.threshold(
                    diff, self.config.motion_threshold, 255, cv2.THRESH_BINARY
                )

                # Morphological operations to clean up noise
                kernel = cv2.getStructuringElement(
                    cv2.MORPH_ELLIPSE,
                    (self.config.dilate_kernel_size, self.config.dilate_kernel_size),
                )
                thresh = cv2.dilate(thresh, kernel, iterations=2)
                thresh = cv2.erode(thresh, kernel, iterations=1)

                # Find contours of moving objects
                contours, _ = cv2.findContours(
                    thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
                )

                for cnt in contours:
                    area = cv2.contourArea(cnt)
                    if area > self.config.min_contour_area:
                        cv2.drawContours(mask, [cnt], -1, 255, cv2.FILLED)
                        num_objects += 1

            prev_gray = gray.copy()

            # Apply mask — replace dynamic regions with neighboring static content (inpaint)
            masked_frame = frame.copy()
            if mask.any():
                masked_frame = cv2.inpaint(frame, mask, 5, cv2.INPAINT_TELEA)

            # Save outputs
            mask_filename = f"mask_{i:05d}.png"
            masked_filename = f"masked_{i:05d}.png"
            mask_path = os.path.join(mask_dir, mask_filename)
            masked_path = os.path.join(masked_dir, masked_filename)

            cv2.imwrite(mask_path, mask)
            cv2.imwrite(masked_path, masked_frame)

            dynamic_ratio = float(mask.sum()) / (h * w * 255) if mask.any() else 0.0

            results.append(MaskResult(
                frame_index=i,
                original_path=fpath,
                masked_path=masked_path,
                mask_path=mask_path,
                dynamic_pixel_ratio=dynamic_ratio,
                num_objects_detected=num_objects,
            ))

        print(f"[Masking] Processed {len(results)} frames, "
              f"avg dynamic ratio: {np.mean([r.dynamic_pixel_ratio for r in results]):.4f}")
        return results

    def mask_frames(
        self, frame_paths: list[str], output_dir: str
    ) -> list[MaskResult]:
        """
        Run dynamic object masking on a set of frames.
        Uses SAM2 if available, otherwise falls back to motion detection.
        """
        if self.config.method == "sam2":
            self._init_sam2()
            if self.sam2_predictor is not None:
                return self._mask_frames_sam2(frame_paths, output_dir)
            print("[Masking] SAM2 unavailable, falling back to motion_diff")

        return self.mask_frames_motion_diff(frame_paths, output_dir)

    def _mask_frames_sam2(
        self, frame_paths: list[str], output_dir: str
    ) -> list[MaskResult]:
        """
        SAM2-based video segmentation masking.
        
        Note: This is a structural placeholder that integrates with the
        SAM2 video predictor API. Actual prompts/class filtering should
        be configured based on the drone footage characteristics.
        """
        os.makedirs(output_dir, exist_ok=True)
        mask_dir = os.path.join(output_dir, "masks")
        masked_dir = os.path.join(output_dir, "masked_frames")
        os.makedirs(mask_dir, exist_ok=True)
        os.makedirs(masked_dir, exist_ok=True)

        # Initialize SAM2 video state
        inference_state = self.sam2_predictor.init_state(
            video_path=os.path.dirname(frame_paths[0])
        )

        results = []
        # SAM2 processes entire video — collect propagated masks
        # In a full implementation, we'd:
        # 1. Run initial prompts on first frame to identify dynamic objects
        # 2. Propagate masks across all frames using SAM2's temporal tracking
        # 3. Apply masks to each frame

        for i, fpath in enumerate(frame_paths):
            frame = cv2.imread(fpath)
            h, w = frame.shape[:2]

            # Placeholder: in real implementation, extract per-frame mask from SAM2
            mask = np.zeros((h, w), dtype=np.uint8)

            masked_frame = frame.copy()
            mask_path = os.path.join(mask_dir, f"mask_{i:05d}.png")
            masked_path = os.path.join(masked_dir, f"masked_{i:05d}.png")

            cv2.imwrite(mask_path, mask)
            cv2.imwrite(masked_path, masked_frame)

            results.append(MaskResult(
                frame_index=i,
                original_path=fpath,
                masked_path=masked_path,
                mask_path=mask_path,
                dynamic_pixel_ratio=0.0,
                num_objects_detected=0,
            ))

        self.sam2_predictor.reset_state(inference_state)
        return results

    def summary(self, results: list[MaskResult]) -> dict:
        """Return summary statistics of masking results."""
        dynamic_ratios = [r.dynamic_pixel_ratio for r in results]
        obj_counts = [r.num_objects_detected for r in results]
        return {
            "total_frames": len(results),
            "frames_with_dynamics": sum(1 for r in results if r.dynamic_pixel_ratio > 0),
            "avg_dynamic_ratio": float(np.mean(dynamic_ratios)) if dynamic_ratios else 0,
            "max_dynamic_ratio": float(np.max(dynamic_ratios)) if dynamic_ratios else 0,
            "total_objects_detected": int(np.sum(obj_counts)),
        }
