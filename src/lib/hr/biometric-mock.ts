import type { BiometricProvider } from "@prisma/client";

export type BiometricDeviceView = {
  id: string;
  name: string;
  provider: BiometricProvider;
  ipAddress: string | null;
  port: number;
  serialNo: string | null;
  apiKey: string;
  status: "ONLINE" | "OFFLINE" | "ERROR" | "SYNCING";
  lastSyncAt: string | null;
  lastError: string | null;
  enabled: boolean;
  branch?: { name: string } | null;
  _count?: { punches: number };
};

export const MOCK_BIOMETRIC_DEVICES: BiometricDeviceView[] = [
  {
    id: "bio-dev-secureye",
    name: "Reception — Secureye S-AIF600",
    provider: "SECUREYE_S_AIF600",
    ipAddress: "192.168.1.210",
    port: 4370,
    serialNo: "S-AIF600-SKM-01",
    apiKey: "demo-key-secureye-aif600",
    status: "ONLINE",
    lastSyncAt: new Date().toISOString(),
    lastError: null,
    enabled: true,
    branch: { name: "Sukma HQ" },
    _count: { punches: 3420 },
  },
  {
    id: "bio-dev-1",
    name: "Main Gate — ZKTeco K40",
    provider: "ZKTECO",
    ipAddress: "192.168.1.201",
    port: 4370,
    serialNo: "ZK-SKM-001",
    apiKey: "demo-key-sukma-gate",
    status: "ONLINE",
    lastSyncAt: new Date().toISOString(),
    lastError: null,
    enabled: true,
    branch: { name: "Sukma HQ" },
    _count: { punches: 1240 },
  },
  {
    id: "bio-dev-2",
    name: "Production Floor — eSSL",
    provider: "ESSL",
    ipAddress: "192.168.1.202",
    port: 4370,
    serialNo: "ESSL-PR-02",
    apiKey: "demo-key-production",
    status: "OFFLINE",
    lastSyncAt: null,
    lastError: "Connection timeout on port 4370",
    enabled: true,
    branch: { name: "Sukma HQ" },
    _count: { punches: 890 },
  },
];

export const MOCK_BIOMETRIC_PUNCHES = [
  {
    id: "p1",
    deviceUserId: "1",
    punchedAt: new Date().toISOString(),
    direction: "IN" as const,
    processed: true,
    device: { name: "Main Gate — ZKTeco K40" },
    employee: { name: "Balarama T", employeeNo: "EMP-001" },
  },
  {
    id: "p2",
    deviceUserId: "2",
    punchedAt: new Date(Date.now() - 3600000).toISOString(),
    direction: "IN" as const,
    processed: false,
    device: { name: "Main Gate — ZKTeco K40" },
    employee: null,
  },
];
