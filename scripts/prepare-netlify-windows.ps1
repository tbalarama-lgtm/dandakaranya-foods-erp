# Prepare node_modules for Netlify local deploy on Windows.
# See scripts/dereference-prisma.mjs — called automatically from netlify.toml build.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "Building ERP..."
npm run build

Write-Host "Dereferencing traced junctions in .next/node_modules..."
node scripts/dereference-prisma.cjs

Write-Host "Deploying to Netlify production..."
npx netlify deploy --prod
