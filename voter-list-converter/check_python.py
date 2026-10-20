"""Check whether the selected interpreter can run core conversion or local OCR."""

from __future__ import annotations

import sys

MIN = (3, 10)
MAX_OCR = (3, 13)
PYTHON312_INSTALLER = "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe"


def main() -> int:
    version = sys.version_info[:2]
    wants_ocr = "--ocr" in sys.argv[1:]
    print(f"Python {sys.version.split()[0]}")
    print(sys.executable)
    if version < MIN:
        print("Need Python 3.10 or newer.")
        return 2
    if wants_ocr and version > MAX_OCR:
        print()
        print("Local OCR is unavailable for this Python version because onnxruntime has no Windows wheel.")
        print("Core conversion for searchable PDFs can still run without OCR.")
        print("For scanned PDFs, install 64-bit Python 3.12 (you can keep this Python):")
        print(PYTHON312_INSTALLER)
        print("Then run run.bat again.")
        return 1
    if version > MAX_OCR:
        print("Note: OCR is disabled for this Python version; searchable PDFs still work.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
