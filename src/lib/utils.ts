import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatInr(amount: number | string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

/** ASCII-safe INR for jsPDF (Helvetica cannot render ₹). */
export function formatInrPdf(amount: unknown) {
  const n = toNumber(amount);
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
  return `Rs. ${formatted}`;
}

export function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function toNumber(v: unknown): number {
  if (v == null) return 0;
  return Number(v);
}
