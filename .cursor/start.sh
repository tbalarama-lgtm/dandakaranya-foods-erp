#!/usr/bin/env bash
# Per-boot startup: make sure the local PostgreSQL cluster is running before the
# dev server (started via the "terminals" entry in environment.json) connects.
set -euo pipefail

PG_VERSION=16

if ! pg_lsclusters -h 2>/dev/null | awk '{print $4}' | grep -q online; then
  sudo pg_ctlcluster "$PG_VERSION" main start || true
fi

for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    echo "[start] PostgreSQL is ready."
    break
  fi
  sleep 1
done
