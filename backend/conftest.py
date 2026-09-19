import sys
from pathlib import Path
from unittest.mock import MagicMock
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.resolve()))

try:
    import cv2
except ImportError:
    mock_cv2 = MagicMock()
    mock_cv2.CAP_PROP_FPS = 5
    mock_cv2.CAP_PROP_FRAME_COUNT = 7
    mock_cv2.CAP_PROP_POS_MSEC = 0
    mock_cv2.CV_64F = 6
    
    def imwrite_mock(*args, **kwargs):
        return True
    
    def imread_mock(*args, **kwargs):
        return np.zeros((64, 64, 3), dtype=np.uint8)
        
    def resize_mock(src, dsize, *args, **kwargs):
        return np.zeros((dsize[1], dsize[0], 3), dtype=np.uint8)
        
    mock_cv2.imwrite = imwrite_mock
    mock_cv2.imread = imread_mock
    mock_cv2.resize = resize_mock
    
    sys.modules['cv2'] = mock_cv2
