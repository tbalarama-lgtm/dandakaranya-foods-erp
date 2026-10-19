# Secure Local Voter Roll Converter

Offline PDF → Excel tool for Indian electoral-roll PDFs (searchable text, or image scans via local OCR). It is a separate local utility from WIN WIN. Files never leave your computer.

Python **3.13** needs package `rapidocr` (not `rapidocr-onnxruntime`, which stops at Python 3.12).

## Install on your computer

You need **Python 3.10–3.13** with Tkinter (the built-in GUI library).

### 1. Get the folder

Clone the repository (or download the ZIP) and open `voter-list-converter`:

```bash
git clone https://github.com/tbalarama-lgtm/dandakaranya-foods-erp.git
cd dandakaranya-foods-erp
git checkout cursor/voter-roll-converter-c283
cd voter-list-converter
```

### 2. Windows

1. Install Python from https://www.python.org/downloads/
2. On the installer, enable **Add python.exe to PATH** and leave **tcl/tk and IDLE** checked.
3. Double-click `run.bat`

Or in Command Prompt:

```bat
cd voter-list-converter
run.bat
```

The window title is **Secure Local Voter Roll Converter**. Choose a searchable `.pdf` roll, set the Excel name, then **Start Secure Conversion**.

### 3. macOS

```bash
# if python3 -c "import tkinter" fails:
brew install python-tk

cd voter-list-converter
chmod +x run.sh
./run.sh
```

### 4. Linux

```bash
sudo apt install python3 python3-venv python3-tk
cd voter-list-converter
chmod +x run.sh
./run.sh
```

### Try it with the sample roll

After the window opens:

1. Browse File → `tests/fixtures/sample-electoral-roll.pdf`
2. Leave the export folder as this directory (or pick Desktop)
3. Start Secure Conversion

You should get two rows (`RAMA RAO`, `LAKSHMI`) in an `.xlsx` file.

## What it extracts

From each voter block marked by `Age :` and `Gender:`:

- Serial No.
- EPIC ID (for example `ZOW0935116`)
- Voter Name
- Relation type and name (Father / Husband / Mother / Other)
- House Number
- Age (integer)
- Gender
- Active **Section No and Name** or **Street Name** from the page header
- Source page

## Limits

- Text PDFs are parsed first. Image-scanned ECI rolls are OCR’d locally (slower, first run downloads an OCR model into the venv).
- Password-protected PDFs are rejected until you unlock a local copy.
- Processing is local only. There is no cloud upload.

## Command line (optional)

```bash
source .venv/bin/activate   # Windows: .venv\Scripts\activate
python -c "from voter_parser import extract_voter_data; extract_voter_data('roll.pdf', output_path='roll.xlsx')"
```

## Tests (developers)

```bash
pip install -r requirements-dev.txt
pytest -q
```
