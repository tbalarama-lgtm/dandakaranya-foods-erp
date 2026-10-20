@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
chcp 65001 >nul

echo BUILD 7 - SEARCHABLE PDF MODE WORKS ON PYTHON 3.15

echo.

if not exist "gui_app.py" (
  echo FILE NOT FOUND: gui_app.py
  pause
  exit /b 1
)

set "PY_LAUNCHER="
set "PY_ARG="
where py >nul 2>nul
if not errorlevel 1 (
  for %%V in (3.12 3.11 3.13 3.10 3.15 3.14) do (
    if not defined PY_LAUNCHER py -%%V -c "import sys" >nul 2>nul && (set "PY_LAUNCHER=py" & set "PY_ARG=-%%V")
  )
)
if not defined PY_LAUNCHER (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3.10 or newer is required.
    echo Install Python from https://www.python.org/downloads/
    pause
    exit /b 1
  )
  set "PY_LAUNCHER=python"
)

echo Using: %PY_LAUNCHER% %PY_ARG%
%PY_LAUNCHER% %PY_ARG% check_python.py
if errorlevel 1 exit /b 1

if not exist ".venv\\Scripts\\python.exe" (
  echo Creating virtual environment...
  %PY_LAUNCHER% %PY_ARG% -m venv .venv
  if errorlevel 1 (
    echo Could not create .venv.
    pause
    exit /b 1
  )
)

call .venv\\Scripts\\activate.bat
python check_python.py
if errorlevel 1 exit /b 1
set PIP_DEFAULT_TIMEOUT=180
set PIP_RETRIES=20
python -m pip install --upgrade pip --default-timeout 180 --retries 20

echo Installing core PDF and Excel packages...
python -m pip install --default-timeout 180 --retries 20 --only-binary :all: pdfplumber==0.11.7 openpyxl==3.1.5 "pymupdf>=1.24.0"
if errorlevel 1 python -m pip install --default-timeout 180 --retries 20 pdfplumber==0.11.7 openpyxl==3.1.5 "pymupdf>=1.24.0"
if errorlevel 1 (
  echo Core packages failed. Check internet and run run.bat again.
  pause
  exit /b 1
)

python check_python.py --ocr >nul 2>nul
if errorlevel 1 (
  echo.
  echo OCR setup skipped: this Python cannot install onnxruntime.
  echo Searchable PDFs will work now. For scanned PDFs install Python 3.12 64-bit and rerun.
) else (
  echo Installing local OCR packages...
  python -m pip install --default-timeout 180 --retries 20 --only-binary :all: "numpy>=1.26.0,<3" "rapidocr>=2.0.6" "onnxruntime>=1.17.0"
  if errorlevel 1 python -m pip install --default-timeout 180 --retries 20 "numpy>=1.26.0,<3" "rapidocr>=2.0.6" "onnxruntime>=1.17.0"
  if errorlevel 1 echo OCR setup skipped. Searchable PDFs still work.
)

echo.
echo Starting Secure Local Voter Roll Converter...
python gui_app.py
if errorlevel 1 pause
