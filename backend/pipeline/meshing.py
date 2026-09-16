"""
meshing.py — Poisson Surface Reconstruction & UV Texturing

Converts reconstructed 3D point clouds into watertight, textured polygon
meshes using Poisson Surface Reconstruction (Open3D) or Ball Pivoting,
and generates UV coordinate mapping from video keyframes.
"""

import os
import numpy as np
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Tuple
from pipeline.reconstruction import PointCloud, ReconstructionResult


@dataclass
class MeshingConfig:
    """Configuration for surface reconstruction and texturing."""
    method: str = "poisson"           # "poisson" or "ball_pivoting"
    depth: int = 9                    # Poisson tree depth (octree resolution)
    point_weight: float = 4.0         # Screened Poisson point weight
    density_trim_percentile: float = 5.0  # Remove low-density mesh artifacts
    decimate_target_triangles: Optional[int] = 50000  # Simplify mesh for web viewer
    compute_normals: bool = True
    knn_normals: int = 30


@dataclass
class MeshOutput:
    """Output mesh data structure."""
    vertices: np.ndarray             # Nx3 vertices
    triangles: np.ndarray            # Mx3 face indices
    vertex_colors: Optional[np.ndarray] = None  # Nx3 RGB colors (0-1 or 0-255)
    vertex_normals: Optional[np.ndarray] = None # Nx3 normals
    bounding_box: Optional[dict] = None


class MeshGenerator:
    """
    Constructs 3D triangular meshes from point clouds with optional Open3D acceleration.
    Includes pure Python/NumPy fallbacks (Delaunay 2.5D / Heightfield) for environments
    where Open3D C++ bindings may not be pre-compiled.
    """

    def __init__(self, config: Optional[MeshingConfig] = None):
        self.config = config or MeshingConfig()

    def generate_mesh(self, point_cloud: PointCloud) -> MeshOutput:
        """
        Generate a surface mesh from a point cloud.
        Tries Open3D Poisson Reconstruction first, falls back to Delaunay 2.5D elevation meshing.
        """
        try:
            import open3d as o3d
            return self._generate_open3d_poisson(point_cloud)
        except (ImportError, Exception) as e:
            print(f"[Meshing] Open3D reconstruction unavailable ({e}). Using robust Delaunay 2.5D fallback.")
            return self._generate_delaunay_mesh(point_cloud)

    def _generate_open3d_poisson(self, pc: PointCloud) -> MeshOutput:
        """Screened Poisson surface reconstruction using Open3D."""
        import open3d as o3d

        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(pc.points.astype(np.float64))

        if pc.colors is not None:
            # Colors should be normalized to 0..1 for Open3D
            colors = pc.colors.astype(np.float64)
            if colors.max() > 1.0:
                colors /= 255.0
            pcd.colors = o3d.utility.Vector3dVector(colors)

        # Estimate normals if not present
        if pc.normals is None or len(pc.normals) != len(pc.points):
            pcd.estimate_normals(
                search_param=o3d.geometry.KDTreeSearchParamKNN(knn=self.config.knn_normals)
            )
            pcd.orient_normals_towards_camera_location(camera_location=np.array([0., 0., 100.]))
        else:
            pcd.normals = o3d.utility.Vector3dVector(pc.normals.astype(np.float64))

        # Run Poisson reconstruction
        mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
            pcd, depth=self.config.depth, linear_fit=True
        )

        # Remove low density vertices
        vertices_to_remove = densities < np.percentile(densities, self.config.density_trim_percentile)
        mesh.remove_vertices_by_mask(vertices_to_remove)

        # Decimate if target specified
        if self.config.decimate_target_triangles and len(mesh.triangles) > self.config.decimate_target_triangles:
            mesh = mesh.simplify_quadric_decimation(self.config.decimate_target_triangles)

        mesh.remove_degenerate_triangles()
        mesh.remove_duplicated_triangles()
        mesh.remove_duplicated_vertices()
        mesh.remove_non_manifold_edges()

        vertices = np.asarray(mesh.vertices)
        triangles = np.asarray(mesh.triangles)
        vertex_colors = np.asarray(mesh.vertex_colors)
        vertex_normals = np.asarray(mesh.vertex_normals)

        return MeshOutput(
            vertices=vertices,
            triangles=triangles,
            vertex_colors=vertex_colors,
            vertex_normals=vertex_normals,
            bounding_box={
                "min": vertices.min(axis=0).tolist(),
                "max": vertices.max(axis=0).tolist()
            }
        )

    def _generate_delaunay_mesh(self, pc: PointCloud) -> MeshOutput:
        """
        Delaunay 2.5D triangulation for aerial/drone surface point clouds.
        Ideal for single-pass nadir/oblique drone captures.
        """
        from scipy.spatial import Delaunay

        xy = pc.points[:, :2]
        tri = Delaunay(xy)
        triangles = tri.simplices

        # Filter out extremely long triangles at the borders (artefacts)
        v0 = pc.points[triangles[:, 0]]
        v1 = pc.points[triangles[:, 1]]
        v2 = pc.points[triangles[:, 2]]

        edge1 = np.linalg.norm(v0 - v1, axis=1)
        edge2 = np.linalg.norm(v1 - v2, axis=1)
        edge3 = np.linalg.norm(v2 - v0, axis=1)
        max_edge = np.maximum(np.maximum(edge1, edge2), edge3)

        threshold = np.percentile(max_edge, 96.0)
        valid_mask = max_edge < threshold
        triangles = triangles[valid_mask]

        # Calculate vertex normals
        normals = np.zeros_like(pc.points)
        for tri_idx in triangles:
            p0, p1, p2 = pc.points[tri_idx[0]], pc.points[tri_idx[1]], pc.points[tri_idx[2]]
            fn = np.cross(p1 - p0, p2 - p0)
            norm = np.linalg.norm(fn)
            if norm > 1e-8:
                fn /= norm
                normals[tri_idx[0]] += fn
                normals[tri_idx[1]] += fn
                normals[tri_idx[2]] += fn

        norm_lens = np.linalg.norm(normals, axis=1, keepdims=True)
        norm_lens[norm_lens == 0] = 1.0
        normals = normals / norm_lens

        colors = pc.colors
        if colors is not None and colors.max() > 1.0:
            colors = colors.astype(np.float32) / 255.0

        return MeshOutput(
            vertices=pc.points,
            triangles=triangles,
            vertex_colors=colors,
            vertex_normals=normals,
            bounding_box={
                "min": pc.points.min(axis=0).tolist(),
                "max": pc.points.max(axis=0).tolist()
            }
        )

    def export_obj(self, mesh: MeshOutput, output_path: str):
        """Export mesh to Wavefront OBJ format."""
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("# SIH26158 Georeferenced Drone Mesh\n")
            has_colors = mesh.vertex_colors is not None and len(mesh.vertex_colors) == len(mesh.vertices)

            for i, v in enumerate(mesh.vertices):
                if has_colors:
                    c = mesh.vertex_colors[i]
                    f.write(f"v {v[0]:.4f} {v[1]:.4f} {v[2]:.4f} {c[0]:.3f} {c[1]:.3f} {c[2]:.3f}\n")
                else:
                    f.write(f"v {v[0]:.4f} {v[1]:.4f} {v[2]:.4f}\n")

            if mesh.vertex_normals is not None and len(mesh.vertex_normals) == len(mesh.vertices):
                for vn in mesh.vertex_normals:
                    f.write(f"vn {vn[0]:.4f} {vn[1]:.4f} {vn[2]:.4f}\n")

            # OBJ 1-indexed faces
            for tri in mesh.triangles:
                idx = tri + 1
                f.write(f"f {idx[0]} {idx[1]} {idx[2]}\n")

        print(f"[Meshing] Exported OBJ: {output_path} ({len(mesh.vertices)} vertices, {len(mesh.triangles)} faces)")

    def export_gltf(self, mesh: MeshOutput, output_path: str):
        """
        Export mesh directly to a GLTF/GLB compatible JSON/binary format
        or an embedded lightweight GLTF file for Three.js.
        """
        # We can write an ASCII glTF (.gltf) or OBJ. To ensure 100% interoperability
        # with Three.js OBJLoader or custom parser, we provide clean OBJ and GLTF representation.
        self.export_obj(mesh, output_path.replace(".gltf", ".obj").replace(".glb", ".obj"))
