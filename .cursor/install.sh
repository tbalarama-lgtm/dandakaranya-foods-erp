#!/usr/bin/env bash
# Idempotent environment bootstrap for the Dandakaranya Foods ERP admin dashboard.
# Installs a local PostgreSQL, prepares the app database, installs Node deps,
# pushes the Prisma schema and seeds demo data.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_VERSION=16
DB_NAME=erp_dev
DB_USER=erp
DB_PASSWORD=erp_password

echo "[install] Ensuring PostgreSQL is installed..."
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
fi

echo "[install] Ensuring PostgreSQL cluster is running..."
if ! pg_lsclusters -h 2>/dev/null | awk '{print $4}' | grep -q online; then
  sudo pg_ctlcluster "$PG_VERSION" main start || true
fi

# Wait for the server to accept connections.
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

echo "[install] Ensuring application role and database exist..."
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}' CREATEDB;
  END IF;
END \$\$;
SQL
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER}; ALTER SCHEMA public OWNER TO ${DB_USER};"

echo "[install] Ensuring .env.local exists..."
if [ ! -f .env.local ]; then
  AUTH_SECRET="$(openssl rand -base64 32)"
  cat > .env.local <<ENV
# Local development environment (Cloud Agent) — local PostgreSQL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public"
DIRECT_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public"

# NextAuth
AUTH_SECRET="${AUTH_SECRET}"
NEXTAUTH_URL="http://localhost:3001"
AUTH_URL="http://localhost:3001"
NEXT_PUBLIC_SITE_URL="http://localhost:3001"

# Dev login fallback (used only if DB is unreachable)
DEV_LOGIN_EMAIL="admin@dandakaranyafoods.com"
DEV_LOGIN_PASSWORD="Admin@2026"
ENV
fi

echo "[install] Installing Node dependencies..."
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "[install] Applying Prisma schema..."
npx dotenv -e .env.local -- prisma db push --skip-generate

# The seed script populates demo data and is only safe on an empty database, so
# only run it the first time (when no users exist yet).
USER_COUNT="$(sudo -u postgres psql -d "${DB_NAME}" -tAc 'SELECT COUNT(*) FROM "User";' 2>/dev/null | tr -d '[:space:]' || echo 0)"
if [ "${USER_COUNT:-0}" = "0" ]; then
  echo "[install] Seeding database..."
  npm run db:seed
else
  echo "[install] Database already seeded (${USER_COUNT} users) — skipping seed."
fi

echo "[install] Done."
