@echo off
setlocal
cd /d "%~dp0"

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

%PY% --version >nul 2>nul
if errorlevel 1 (
  echo FILE NOT FOUND: Python
  echo Install Python 3.10+ from https://www.python.org/downloads/
  echo Tick "Add python.exe to PATH" and leave "tcl/tk and IDLE" enabled, then try run.bat again.
  pause
  exit /b 1
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
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo.
echo Starting Secure Local Voter Roll Converter...
python gui_app.py
if errorlevel 1 pause
