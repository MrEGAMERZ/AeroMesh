from .base import BaseReconstructionEngine, ReconstructionResult, PointCloud, CameraPose
from .demo import DemoEngine

def get_engine(name: str) -> BaseReconstructionEngine:
    name = name.lower().strip()
    if name == "colmap":
        from .colmap import ColmapEngine
        return ColmapEngine()
    elif name in ("vggsfm", "vggt", "mapanything", "dust3r"):
        from .vggsfm import VGGSfMEngine
        return VGGSfMEngine(model_name=name)
    elif name in ("sfm", "opencv", "default"):
        from .sfm import SfMEngine
        return SfMEngine()
    elif name == "demo":
        return DemoEngine()
    else:
        # Unknown engine: fall back to SfM (real reconstruction)
        print(f"[Engine] Unknown engine '{name}', falling back to SfM (real reconstruction).")
        from .sfm import SfMEngine
        return SfMEngine()

