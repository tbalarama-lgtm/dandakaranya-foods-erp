"""Exit 0 only if this interpreter can install RapidOCR / onnxruntime wheels."""

from __future__ import annotations

import sys

MIN = (3, 10)
MAX_INCLUSIVE = (3, 13)
PYTHON312_INSTALLER = "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe"


def main() -> int:
    version = sys.version_info[:2]
    print(f"Python {sys.version.split()[0]}")
    print(sys.executable)
    if version < MIN:
        print("Need Python 3.10 or newer.")
        return 2
    if version > MAX_INCLUSIVE:
        print()
        print("This Python is too new for local OCR.")
        print("onnxruntime has no Windows wheel for Python 3.14/3.15.")
        print("Install 64-bit Python 3.12 (keep 3.15 if you want):")
        print(PYTHON312_INSTALLER)
        print()
        print("On the installer tick:")
        print('  - Add python.exe to PATH')
        print('  - tcl/tk and IDLE')
        print("Then double-click run.bat again.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
