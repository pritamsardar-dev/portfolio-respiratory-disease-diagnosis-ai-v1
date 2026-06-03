import os
from typing import List


def cleanup_files(paths: List[str]) -> int:
    removed = 0
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
                removed += 1
        except Exception as e:
            # Non-fatal — log and continue
            print(f"Warning: could not remove temp file {path}: {e}")
    return removed
