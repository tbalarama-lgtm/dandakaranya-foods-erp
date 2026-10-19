@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
chcp 65001 >nul

echo BUILD 6 - REQUIRES PYTHON 3.12 (not 3.15)
echo.
echo Your screenshot showed cp315 / onnxruntime versions: none
echo That means Python 3.15 is active. OCR needs Python 3.12.
echo.

if not exist "gui_app.py" (
  echo FILE NOT FOUND: gui_app.py
  echo Extract the zip first so run.bat and gui_app.py are in the same folder.
  pause
  exit /b 1
)

set "PY_LAUNCHER="
set "PY_ARG="
where py >nul 2>nul
if not errorlevel 1 (
  py -3.12 -c "import sys" >nul 2>nul && (set "PY_LAUNCHER=py" & set "PY_ARG=-3.12")
  if not defined PY_LAUNCHER py -3.11 -c "import sys" >nul 2>nul && (set "PY_LAUNCHER=py" & set "PY_ARG=-3.11")
  if not defined PY_LAUNCHER py -3.13 -c "import sys" >nul 2>nul && (set "PY_LAUNCHER=py" & set "PY_ARG=-3.13")
  if not defined PY_LAUNCHER py -3.10 -c "import sys" >nul 2>nul && (set "PY_LAUNCHER=py" & set "PY_ARG=-3.10")
)

if defined PY_LAUNCHER (
  echo Using: %PY_LAUNCHER% %PY_ARG%
  %PY_LAUNCHER% %PY_ARG% check_python.py
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo FILE NOT FOUND: Python 3.12
    echo Download and install:
    echo https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe
    echo Tick "Add python.exe to PATH" and leave "tcl/tk and IDLE" enabled.
    pause
    exit /b 1
  )
  python check_python.py
)

if errorlevel 1 (
  echo.
  echo STOPPED: install Python 3.12 64-bit, then run this file again.
  echo https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe
  pause
  exit /b 1
)

if exist ".venv\Scripts\python.exe" (
  .venv\Scripts\python.exe check_python.py >nul 2>nul
  if errorlevel 1 (
    echo Existing .venv was created with Python 3.15. Deleting it so 3.12 can be used...
    rmdir /s /q ".venv"
  )
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating virtual environment with Python 3.12...
  if defined PY_LAUNCHER (
    %PY_LAUNCHER% %PY_ARG% -m venv .venv
  ) else (
    python -m venv .venv
  )
  if errorlevel 1 (
    echo Could not create .venv. Install Python 3.12 and tick Add to PATH.
    pause
    exit /b 1
  )
)

call .venv\Scripts\activate.bat
python check_python.py
if errorlevel 1 (
  pause
  exit /b 1
)

set PIP_DEFAULT_TIMEOUT=180
set PIP_RETRIES=20
python -m pip install --upgrade pip --default-timeout 180 --retries 20

echo.
echo Step 1/2: PDF and Excel libraries...
python -m pip install --default-timeout 180 --retries 20 --only-binary :all: pdfplumber==0.11.7 openpyxl==3.1.5 "pymupdf>=1.24.0"
if errorlevel 1 python -m pip install --default-timeout 180 --retries 20 pdfplumber==0.11.7 openpyxl==3.1.5 "pymupdf>=1.24.0"
if errorlevel 1 (
  echo Core PDF/Excel packages failed. Check internet and run.bat again.
  pause
  exit /b 1
)

echo.
echo Step 2/2: Local OCR (rapidocr + onnxruntime for Python 3.12)...
python -m pip install --default-timeout 180 --retries 20 --only-binary :all: "numpy>=1.26.0,<3" "rapidocr>=2.0.6" "onnxruntime>=1.17.0"
if errorlevel 1 python -m pip install --default-timeout 180 --retries 20 "numpy>=1.26.0,<3" "rapidocr>=2.0.6" "onnxruntime>=1.17.0"
if errorlevel 1 (
  echo OCR install failed. Check internet / VPN and double-click run.bat again.
  pause
  exit /b 1
)

echo.
echo Starting Secure Local Voter Roll Converter...
python gui_app.py
if errorlevel 1 pause
