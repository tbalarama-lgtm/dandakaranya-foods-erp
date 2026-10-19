@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

echo BUILD 5 - PYTHON 3.13 LOCAL OCR
echo.
echo pdfplumber / openpyxl / pymupdf install first.
echo Then RapidOCR (package name: rapidocr). Yellow lines are retries - leave this window open.
echo.

if not exist "gui_app.py" (
  echo FILE NOT FOUND: gui_app.py
  echo Open the unzipped folder named voter-list-converter so you can see run.bat and gui_app.py together.
  pause
  exit /b 1
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  set PY=py -3
) else (
  set PY=python
)

%PY% --version
%PY% --version >nul 2>nul
if errorlevel 1 (
  echo FILE NOT FOUND: Python
  echo Install Python 3.10+ from https://www.python.org/downloads/
  echo Tick "Add python.exe to PATH" and leave "tcl/tk and IDLE" enabled, then try run.bat again.
  pause
  exit /b 1
)

if exist ".venv\Lib\site-packages\pandas" (
  echo Removing broken .venv that still contains pandas...
  rmdir /s /q ".venv"
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating virtual environment...
  %PY% -m venv .venv
  if errorlevel 1 (
    echo Python 3.10+ is required. Install it from https://www.python.org/downloads/
    echo During setup, enable "tcl/tk" and "Add python.exe to PATH".
    pause
    exit /b 1
  )
)

call .venv\Scripts\activate.bat
set PIP_DEFAULT_TIMEOUT=180
set PIP_RETRIES=20
python -m pip install --upgrade pip --default-timeout 180 --retries 20

echo.
echo Step 1/2: PDF and Excel libraries...
python -m pip install --default-timeout 180 --retries 20 --only-binary :all: pdfplumber==0.11.7 openpyxl==3.1.5 "pymupdf>=1.24.0"
if errorlevel 1 python -m pip install --default-timeout 180 --retries 20 pdfplumber==0.11.7 openpyxl==3.1.5 "pymupdf>=1.24.0"
if errorlevel 1 (
  echo Core PDF/Excel packages failed. Check internet and run.bat again. Do not delete .venv.
  pause
  exit /b 1
)

echo.
echo Step 2/2: Local OCR for image-scanned ECI rolls (Python 3.13 compatible)...
python -m pip install --default-timeout 180 --retries 20 --only-binary :all: "numpy>=1.26.0,<3" "rapidocr>=2.0.6" "onnxruntime>=1.17.0"
if errorlevel 1 python -m pip install --default-timeout 180 --retries 20 "numpy>=1.26.0,<3" "rapidocr>=2.0.6" "onnxruntime>=1.17.0"
if errorlevel 1 (
  echo OCR extra failed. Trying last-resort old package 1.2.3...
  python -m pip install --default-timeout 180 --retries 20 "rapidocr-onnxruntime==1.2.3"
)
if errorlevel 1 (
  echo OCR could not be installed. The window will still open for text PDFs.
  echo For image rolls, keep internet on and run Step 2 later:
  echo   .venv\Scripts\python.exe -m pip install rapidocr onnxruntime
)

echo.
echo Starting Secure Local Voter Roll Converter...
python gui_app.py
if errorlevel 1 pause
