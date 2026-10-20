# Secure Local Voter Roll Converter

Offline PDF → Excel tool for Indian electoral-roll PDFs. Searchable PDFs work with the core PDF/Excel packages; image scans use local OCR. Files never leave your computer.

## Windows install

Use 64-bit Python 3.12 for the full feature set. Python 3.14/3.15 cannot currently install the Windows onnxruntime wheel required by OCR, but they can still convert searchable PDFs.

1. Install Python from https://www.python.org/downloads/ (Python 3.12 is recommended; keep 3.15 if already installed).
2. Leave **tcl/tk and IDLE** checked.
3. Double-click `run.bat`.

The launcher selects an installed Python, creates/reuses `.venv`, installs core PDF/Excel dependencies, and installs OCR only when supported. On Python 3.15 it continues in searchable-PDF mode and tells you how to add Python 3.12 later for scanned rolls.

The window title is **Secure Local Voter Roll Converter**. Choose a PDF, set the Excel name, then click **Start Secure Conversion**.

## macOS and Linux

```bash
# macOS, if tkinter is unavailable:
brew install python-tk

# Linux:
sudo apt install python3 python3-venv python3-tk

./run.sh
```

## Try the sample

Choose `tests/fixtures/sample-electoral-roll.pdf`; the converter should produce two rows (`RAMA RAO`, `LAKSHMI`) in an `.xlsx` file.

## OCR tradeoff

Python 3.15 mode is immediately usable for text PDFs and avoids a failed setup. It cannot process image-only rolls until a compatible Python (recommended: 3.12 64-bit) is installed and `run.bat` is rerun. Keeping the fallback is preferable to forcing users to uninstall or replace their newer Python, while accepting that scanned-PDF support remains an optional environment upgrade.

## Limits

- OCR runs locally and downloads its model into the virtual environment on first setup.
- Password-protected PDFs must be unlocked locally first.
- Processing is local only; there is no cloud upload.

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q
```
