@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

echo BUILD 4 - LOCAL OCR FOR IMAGE ROLLS
echo.
echo Yellow timeout lines mean the download is retrying. Leave this window open.
echo.

findstr /I /C:"pandas" "requirements.txt" >nul 2>nul
if %ERRORLEVEL%==0 (
  echo WRONG COPY: requirements.txt still lists pandas.
  echo Close this window, delete this whole folder, and unzip VOTER-CONVERTER-OCR-v4.zip
  pause
  exit /b 1
)

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
echo Installing packages. First OCR install can take several minutes...
python -m pip install --default-timeout 180 --retries 20 --only-binary :all: -r requirements.txt
if errorlevel 1 (
  echo Binary-only install missed a wheel. Retrying with source packages allowed...
  python -m pip install --default-timeout 180 --retries 20 -r requirements.txt
)
if errorlevel 1 (
  echo PyPI timed out. Trying the official index again...
  python -m pip install --default-timeout 180 --retries 20 --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt
)
if errorlevel 1 (
  echo.
  echo Package install failed because the computer could not reach pypi.org.
  echo Check internet / VPN / firewall, then double-click run.bat again.
  echo You do not need to delete .venv unless pandas was installed.
  pause
  exit /b 1
)
echo.
echo Starting Secure Local Voter Roll Converter...
python gui_app.py
if errorlevel 1 pause
