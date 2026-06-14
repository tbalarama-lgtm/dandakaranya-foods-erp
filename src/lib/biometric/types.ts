import type { BiometricProvider, PunchDirection } from "@prisma/client";

export type BiometricPunchInput = {
  deviceUserId: string;
  punchedAt: string | Date;
  direction?: PunchDirection | "IN" | "OUT";
};

export type WebhookPayload = {
  deviceSerial?: string;
  punches?: BiometricPunchInput[];
  /** Single punch shortcut */
  deviceUserId?: string;
  punchedAt?: string;
  direction?: PunchDirection | "IN" | "OUT";
};

export type DeviceConnectionInput = {
  name: string;
  provider: BiometricProvider;
  ipAddress?: string;
  port?: number;
  serialNo?: string;
  branchId?: string;
};

export type SyncResult = {
  deviceId: string;
  punchesReceived: number;
  punchesProcessed: number;
  attendanceUpdated: number;
  errors: string[];
};
