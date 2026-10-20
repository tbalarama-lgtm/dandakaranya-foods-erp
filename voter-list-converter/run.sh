#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3.10+ is required."
  exit 1
fi

if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate
export PIP_DEFAULT_TIMEOUT=180
python -m pip install --upgrade pip --default-timeout 180 --retries 20
python -m pip install --default-timeout 180 --retries 20 --only-binary :all: -r requirements.txt \
  || python -m pip install --default-timeout 180 --retries 20 -r requirements.txt \
  || python -m pip install --default-timeout 180 --retries 20 pdfplumber==0.11.7 openpyxl==3.1.5 "pymupdf>=1.24.0"
python gui_app.py
