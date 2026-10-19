import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export function StatusBadge({
  tone,
  children
}: {
  tone: BadgeTone;
  children: ReactNode;
}): JSX.Element {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function consentTone(status: string): BadgeTone {
  if (status === "given") return "success";
  if (status === "not_given" || status === "withdrawn") return "danger";
  return "warning";
}

export function issueTone(status: string): BadgeTone {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "in_progress") return "info";
  return "warning";
}

export function taskTone(status: string): BadgeTone {
  if (status === "done") return "success";
  if (status === "cancelled") return "neutral";
  if (status === "in_progress") return "info";
  return "warning";
}

export function assignmentTone(status: string): BadgeTone {
  return status === "active" ? "success" : "neutral";
}

export function verificationTone(status: string): BadgeTone {
  if (status === "verified") return "success";
  if (status === "needs_review") return "warning";
  return "neutral";
}
