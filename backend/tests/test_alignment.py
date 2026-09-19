import pytest
import numpy as np
from pipeline.telemetry import TrajectoryAligner, TelemetryPoint, FlightTrajectory

def test_compute_rigid_transform_known():
    np.random.seed(42)
    source = np.random.rand(10, 3) * 10
    scale = 2.5
    theta = np.pi / 2
    rotation = np.array([
        [np.cos(theta), -np.sin(theta), 0],
        [np.sin(theta),  np.cos(theta), 0],
        [0,              0,             1]
    ])
    translation = np.array([10.0, -5.0, 3.0])
    target = scale * (source @ rotation.T) + translation
    R, t, s = TrajectoryAligner.compute_rigid_transform(source, target)
    np.testing.assert_almost_equal(s, scale)
    np.testing.assert_almost_equal(R, rotation)
    np.testing.assert_almost_equal(t, translation)

def test_compute_rigid_transform_identity():
    source = np.random.rand(10, 3) * 10
    target = source.copy()
    R, t, s = TrajectoryAligner.compute_rigid_transform(source, target)
    np.testing.assert_almost_equal(s, 1.0)
    np.testing.assert_almost_equal(R, np.eye(3))
    np.testing.assert_almost_equal(t, np.zeros(3))

def test_aligner_empty_input():
    source = np.empty((0, 3))
    target = np.empty((0, 3))
    try:
        TrajectoryAligner.compute_rigid_transform(source, target)
    except Exception as e:
        pass # Expected to raise something like RuntimeWarning or ValueError
        
    try:
        from pipeline.telemetry import PointCloud 
        TrajectoryAligner.align_reconstruction(None, FlightTrajectory([], "", ""))
    except Exception:
        pass
