import os
import cv2
import numpy as np
from typing import Optional
from .base import BaseReconstructionEngine, ReconstructionResult, PointCloud, CameraPose

class GenerativeChunkEngine(BaseReconstructionEngine):
    """
    Simulates a modern Image-to-3D Generative AI model by analyzing the structure
    of the video frame, breaking it down, and generating a volumetric 'chunk-by-chunk'
    Minecraft-style solid 3D building/farm layout.
    """
    def get_capabilities(self) -> dict:
        return {"requires_gpu": False, "metric_scale": False, "engine": "genai_chunk"}

    def validate_inputs(self, frame_paths: list, telemetry=None) -> None:
        if not frame_paths:
            raise ValueError("No frames provided.")

    def reconstruct(self, frame_paths: list, camera_intrinsics=None, initial_altitude=None) -> ReconstructionResult:
        # Use center frame as the AI basis
        mid = len(frame_paths) // 2
        img = cv2.imread(frame_paths[mid])
        h, w = img.shape[:2]
        
        # We will voxelize into a 64x64 grid to give the chunk-by-chunk Minecraft vibe
        grid_w, grid_h = 75, 75
        chunk_w, chunk_h = w / grid_w, h / grid_h
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # AI Structure understanding via gradients (finds the buildings/walls vs ground)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        gx = cv2.Sobel(blur, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(blur, cv2.CV_32F, 0, 1, ksize=3)
        grad = np.sqrt(gx**2 + gy**2)
        grad_norm = cv2.normalize(grad, None, 0, 255, cv2.NORM_MINMAX)
        grad_blur = cv2.GaussianBlur(grad_norm, (31, 31), 0) # massive blur for solid chunks
        
        vertices = []
        triangles = []
        colors = []
        
        v_idx = 0
        
        print(f"[GenerativeAI] Analyzing scene and generating {grid_w}x{grid_h} chunks...")
        
        for gy_idx in range(grid_h):
            for gx_idx in range(grid_w):
                # source pixel region
                x1 = int(gx_idx * chunk_w)
                y1 = int(gy_idx * chunk_h)
                x2 = int((gx_idx + 1) * chunk_w)
                y2 = int((gy_idx + 1) * chunk_h)
                
                # Extract chunk area
                roi = img[y1:y2, x1:x2]
                if roi.size == 0: continue
                c = np.mean(roi, axis=(0,1))
                color = [c[2]/255.0, c[1]/255.0, c[0]/255.0] # BGR to RGB
                
                # Height calculation based on AI understanding of structure
                structure_score = np.mean(grad_blur[y1:y2, x1:x2])
                
                # Discrete heights for that "Minecraft / Generated Building" look
                if structure_score < 30:
                    height = 0.5  # Ground/Grass
                elif structure_score < 80:
                    height = 8.0  # Walls / Small structures / Trees
                else:
                    height = 25.0 # Main buildings
                    
                # 3D Coordinates
                # We center the model at 0,0
                cx = (gx_idx - grid_w/2) * 1.5
                cy = (gy_idx - grid_h/2) * 1.5
                s = 0.75 # Half-size of the cube chunk
                
                # Bottom vertices (z=0)
                b0 = [cx-s, cy-s, 0]
                b1 = [cx+s, cy-s, 0]
                b2 = [cx+s, cy+s, 0]
                b3 = [cx-s, cy+s, 0]
                # Top vertices (z=height)
                t0 = [cx-s, cy-s, height]
                t1 = [cx+s, cy-s, height]
                t2 = [cx+s, cy+s, height]
                t3 = [cx-s, cy+s, height]
                
                cube_verts = [b0,b1,b2,b3, t0,t1,t2,t3]
                for v in cube_verts:
                    vertices.append(v)
                    colors.append(color)
                    
                # Triangles (12 per cube)
                # Bottom face
                triangles.append([v_idx+2, v_idx+1, v_idx+0])
                triangles.append([v_idx+3, v_idx+2, v_idx+0])
                # Top face
                triangles.append([v_idx+4, v_idx+5, v_idx+6])
                triangles.append([v_idx+4, v_idx+6, v_idx+7])
                # Front face
                triangles.append([v_idx+0, v_idx+1, v_idx+5])
                triangles.append([v_idx+0, v_idx+5, v_idx+4])
                # Right face
                triangles.append([v_idx+1, v_idx+2, v_idx+6])
                triangles.append([v_idx+1, v_idx+6, v_idx+5])
                # Back face
                triangles.append([v_idx+2, v_idx+3, v_idx+7])
                triangles.append([v_idx+2, v_idx+7, v_idx+6])
                # Left face
                triangles.append([v_idx+3, v_idx+0, v_idx+4])
                triangles.append([v_idx+3, v_idx+4, v_idx+7])
                
                v_idx += 8
                
        # Fake camera poses to prevent crash in JSON export
        R_global = np.eye(3, dtype=np.float64)
        t_global = np.zeros((3, 1), dtype=np.float64)
        camera_poses = [CameraPose(frame_index=0, rotation=R_global.copy(), translation=t_global.flatten(), focal_length=1000.0)]
        
        mesh_data = {
            "vertices": np.array(vertices, dtype=np.float32),
            "triangles": np.array(triangles, dtype=np.int32),
            "colors": np.array(colors, dtype=np.float32)
        }
        
        # Point cloud fallback
        pc = PointCloud(points=mesh_data["vertices"], colors=(mesh_data["colors"]*255).astype(np.uint8))
        
        return ReconstructionResult(
            point_cloud=pc,
            camera_poses=camera_poses,
            scale_factor=1.0,
            engine_name="genai_chunk",
            mesh_data=mesh_data,
            diagnostics={"chunks_generated": grid_w * grid_h}
        )
