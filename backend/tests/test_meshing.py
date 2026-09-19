import pytest
import numpy as np

def test_delaunay_fallback():
    # Test the NumPy-only Delaunay 2.5D mesh (no Open3D needed)
    from pipeline.meshing import MeshGenerator, MeshingConfig
    try:
        from pipeline.reconstruction import PointCloud
    except ImportError:
        from pipeline.engines.base import PointCloud
    
    gen = MeshGenerator(MeshingConfig())
    # Simple 10x10 grid of points
    x = np.linspace(-10, 10, 10)
    y = np.linspace(-10, 10, 10)
    xx, yy = np.meshgrid(x, y)
    points = np.stack([xx.ravel(), yy.ravel(), np.zeros(100)], axis=1).astype(np.float32)
    colors = np.zeros_like(points)
    
    try:
        pc = PointCloud(points=points, colors=colors)
    except TypeError:
        pc = PointCloud(points=points)
        
    mesh = gen.generate_mesh(pc)
    
    assert mesh is not None
    assert len(mesh.vertices) > 0
    assert len(mesh.triangles) > 0
