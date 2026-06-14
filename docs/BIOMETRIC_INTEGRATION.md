# Biometric attendance integration

## Overview

HR → **Biometric** (`/hr/attendance/biometric`) registers devices, maps employee IDs, syncs punches, and writes **Attendance** rows (check-in/out, late, overtime).

Supported providers: **Secureye S-AIF600** (face + finger, ADMS push), **ZKTeco**, **eSSL**, **Realtime**, **Webhook**.

See **[SECUREYE_S-AIF600.md](./SECUREYE_S-AIF600.md)** for full Secureye setup.

## Setup

1. Migrate and seed:

```bash
npm run db:push -- --accept-data-loss
npm run db:seed
```

2. Open **HR → Biometric** and copy the device **API key**.

3. Point your device agent to:

```
POST https://your-domain/api/v1/hr/biometric/webhook
Header: X-Device-Key: <device-api-key>
Content-Type: application/json
```

Example body:

```json
{
  "punches": [
    { "deviceUserId": "1", "punchedAt": "2026-05-19T09:02:00+05:30", "direction": "IN" },
    { "deviceUserId": "1", "punchedAt": "2026-05-19T18:05:00+05:30", "direction": "OUT" }
  ]
}
```

4. Map each `deviceUserId` to an employee under **Map employee ↔ device user ID** (stored as `Employee.biometricUserId`).

5. Use **Sync** for TCP devices or rely on webhook auto-processing.

## API (authenticated unless noted)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/hr/biometric/devices` | List devices |
| POST | `/api/v1/hr/biometric/devices` | Register device |
| POST | `/api/v1/hr/biometric/sync` | Pull/process punches `{ deviceId? }` |
| POST | `/api/v1/hr/biometric/webhook` | **Public** — ingest punches (API key) |
| POST | `/api/v1/hr/biometric/map-employee` | `{ employeeId, biometricUserId }` |
| GET | `/api/v1/hr/biometric/punches` | Recent punch log |

## Environment

```env
BIOMETRIC_SHIFT_START_HOUR=9
BIOMETRIC_SHIFT_START_MINUTE=0
BIOMETRIC_LATE_GRACE_MINUTES=15
BIOMETRIC_SHIFT_END_HOUR=18
BIOMETRIC_SHIFT_END_MINUTE=0
ZKTECO_DEFAULT_PORT=4370
BIOMETRIC_WEBHOOK_SECRET=optional-global-fallback
```

## ZKTeco / eSSL agents

For live TCP devices, run a small agent on the LAN (e.g. Python `pyzk` or Node `node-zklib`) that polls the device and POSTs to the webhook. The built-in **Sync** button uses a demo pull when the device IP is unreachable.

Seed device key: `demo-key-sukma-gate` (employee biometric user id `1` → EMP-001).
