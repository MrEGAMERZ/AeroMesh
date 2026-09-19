from .base import BaseReconstructionEngine, ReconstructionResult, PointCloud, CameraPose
from .demo import DemoEngine

def get_engine(name: str) -> BaseReconstructionEngine:
    name = name.lower()
    if name == "colmap":
        from .colmap import ColmapEngine
        return ColmapEngine()
    elif name in ("vggsfm", "vggt", "mapanything"):
        from .vggsfm import VGGSfMEngine
        return VGGSfMEngine(model_name=name)
    elif name == "demo":
        return DemoEngine()
    else:
        raise ValueError(f"Unknown engine: {name!r}. Available: colmap, vggsfm, demo")
