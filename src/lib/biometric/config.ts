/** Shift rules for late / overtime calculation after biometric sync */
export const biometricConfig = {
  shiftStartHour: Number(process.env.BIOMETRIC_SHIFT_START_HOUR ?? 9),
  shiftStartMinute: Number(process.env.BIOMETRIC_SHIFT_START_MINUTE ?? 0),
  lateGraceMinutes: Number(process.env.BIOMETRIC_LATE_GRACE_MINUTES ?? 15),
  shiftEndHour: Number(process.env.BIOMETRIC_SHIFT_END_HOUR ?? 18),
  shiftEndMinute: Number(process.env.BIOMETRIC_SHIFT_END_MINUTE ?? 0),
  zktecoDefaultPort: Number(process.env.ZKTECO_DEFAULT_PORT ?? 4370),
  webhookSecret: process.env.BIOMETRIC_WEBHOOK_SECRET ?? "",
};

export function shiftStartOnDate(date: Date): Date {
  const d = new Date(date);
  d.setHours(biometricConfig.shiftStartHour, biometricConfig.shiftStartMinute, 0, 0);
  return d;
}

export function lateThresholdOnDate(date: Date): Date {
  const start = shiftStartOnDate(date);
  return new Date(start.getTime() + biometricConfig.lateGraceMinutes * 60_000);
}

export function shiftEndOnDate(date: Date): Date {
  const d = new Date(date);
  d.setHours(biometricConfig.shiftEndHour, biometricConfig.shiftEndMinute, 0, 0);
  return d;
}
