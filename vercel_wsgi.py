"""Load the Django application from the repository root on Vercel."""

import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))
application = importlib.import_module("config.wsgi").application
