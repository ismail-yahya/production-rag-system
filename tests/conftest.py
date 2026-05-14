import sys
from unittest.mock import MagicMock

# Mock sentence_transformers and other problematic ML libraries to prevent
# Windows access violations and model downloads during unit test collection.
mock_st = MagicMock()
sys.modules["sentence_transformers"] = mock_st
