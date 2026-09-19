import pytest
import os
import tempfile
import numpy as np
try:
    import cv2
except ImportError:
    cv2 = None

def test_get_demo_engine():
    try:
        from pipeline.engines import get_engine
    except ImportError:
        pytest.skip("pipeline.engines not yet implemented (Lane A)")
    engine = get_engine("demo")
    assert engine.get_capabilities()["engine"] == "demo"

def test_get_colmap_engine_does_not_crash_at_import():
    try:
        from pipeline.engines import get_engine
    except ImportError:
        pytest.skip("pipeline.engines not yet implemented (Lane A)")
    engine = get_engine("colmap")
    assert engine is not None

def test_get_vggsfm_engine():
    try:
        from pipeline.engines import get_engine
    except ImportError:
        pytest.skip("pipeline.engines not yet implemented (Lane A)")
    engine = get_engine("vggsfm")
    assert engine.get_capabilities()["requires_gpu"] is True

def test_get_unknown_engine_raises():
    try:
        from pipeline.engines import get_engine
    except ImportError:
        pytest.skip("pipeline.engines not yet implemented (Lane A)")
    with pytest.raises(ValueError, match="Unknown engine"):
        get_engine("nonexistent_engine")

def test_demo_engine_reconstruct_with_no_frames():
    try:
        from pipeline.engines import get_engine
    except ImportError:
        pytest.skip("pipeline.engines not yet implemented (Lane A)")
    engine = get_engine("demo")
    with pytest.raises(ValueError):
        engine.validate_inputs([])

def test_demo_engine_reconstruct_synthetic():
    if cv2 is None:
        pytest.skip("cv2 not available")
    try:
        from pipeline.engines import get_engine
    except ImportError:
        pytest.skip("pipeline.engines not yet implemented (Lane A)")
    engine = get_engine("demo")
    with tempfile.TemporaryDirectory() as tmpdir:
        frame_paths = []
        for i in range(3):
            p = os.path.join(tmpdir, f"frame_{i:05d}.jpg")
            img = np.random.randint(0, 255, (64, 64, 3), dtype=np.uint8)
            cv2.imwrite(p, img)
            frame_paths.append(p)
        result = engine.reconstruct(frame_paths, initial_altitude=50.0)
        assert result.point_cloud is not None
        assert len(result.point_cloud.points) > 0
        assert result.engine_name == "demo"
