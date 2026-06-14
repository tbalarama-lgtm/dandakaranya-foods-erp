# Secureye S-AIF600 integration

**Model:** S-AIF600 — Wide Dynamic Face & Finger Recognition  
**Capacity:** 1,500 users · 150,000 logs  
**Connectivity:** Ethernet, Wi-Fi, P2P · ONtime software/SDK  

## Recommended: ADMS cloud push (built into ERP)

The S-AIF600 firmware is compatible with the **ZK ADMS push protocol** used by many face terminals in India.

### 1. Register in ERP

1. **HR → Biometric → Add device**
2. Provider: **Secureye S-AIF600**
3. **Serial No (SN):** from device screen, ONtime, or sticker (e.g. `S-AIF600-SKM-01`)
4. **IP address:** static LAN IP of the device (e.g. `192.168.1.210`)

### 2. Configure device Cloud Server

On the device (menu names may vary):

| Setting | Value |
|--------|--------|
| Server mode | ADMS / Cloud / Push |
| Server IP | Your ERP PC/server LAN IP |
| Server port | `3001` (or your Next.js port) |
| HTTPS | Off (unless you terminate TLS on reverse proxy) |

The device will call:

- `GET http://<server>:3001/iclock/getrequest?SN=<your-serial>`
- `POST http://<server>:3001/iclock/cdata?SN=<your-serial>&table=ATTLOG`

Body format (tab-separated per line):

```
<PIN>	<DateTime>	<Status>	<Verify>	<InOut>	<WorkCode>
1	2026-05-19 09:02:00	0	15	0	0
```

`InOut`: `0` = check-in, `1` = check-out.

### 3. Map employees

Each enrolled user has a **PIN** on the device. In ERP:

**HR → Biometric → Map employee** → PIN `1` → employee record (`biometricUserId`).

### 4. Verify

- Device status should show **ONLINE** after heartbeat
- **Recent punch log** shows new rows
- **HR → Attendance** updates check-in/out, late, overtime

## Alternative: ONtime + webhook

If ADMS menu is not available:

1. Install **Secureye ONtime** on a Windows PC on the same LAN
2. Export or use SDK to forward logs to:

```
POST http://<server>:3001/api/v1/hr/biometric/webhook
X-Device-Key: <api-key-from-erp>
Content-Type: application/json

{
  "punches": [
    { "deviceUserId": "1", "punchedAt": "2026-05-19T09:02:00+05:30", "direction": "IN" }
  ]
}
```

ONtime JSON export is also supported via `attendance` / `logs` arrays.

## Seed credentials (after `npm run db:seed`)

| Field | Value |
|-------|--------|
| Serial (SN) | `S-AIF600-SKM-01` |
| API key | `demo-key-secureye-aif600` |
| Employee PIN | `1` → EMP-001 (Balarama T) |

## Troubleshooting

| Issue | Action |
|-------|--------|
| Device stays OFFLINE | Ping ERP from device subnet; open firewall port 3001 |
| UNKNOWN DEVICE on push | SN in ERP must match `SN=` query param exactly |
| Unmapped punches | Map PIN to `biometricUserId` on employee |
| No ADMS menu | Use ONtime webhook or contact Secureye for firmware with push enabled |

## Support

Secureye India: **1800 1022 366** (sales) · **9400940039** (support)  
Product page: https://www.secureye.com/product/s-aif600-wide-dynamic-face-finger-recognition-device
