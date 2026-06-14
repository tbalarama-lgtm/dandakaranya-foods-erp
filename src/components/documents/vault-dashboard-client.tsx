"use client";

import Link from "next/link";
import {
  FileText,
  Clock,
  Upload,
  CheckCircle2,
  Building2,
  HardDrive,
  Share2,
  Archive,
  Star,
  Shield,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatFileSize } from "@/lib/documents/format";
import { DEPARTMENT_LABELS } from "@/lib/documents/constants";
import type { DocumentDepartment } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";

type Metrics = {
  total: number;
  expiring: number;
  recent: number;
  pendingApprovals: number;
  shared: number;
  archived: number;
  storageBytes: number;
  byDepartment: { department: DocumentDepartment; count: number }[];
};

type ActivityDoc = {
  id: string;
  title: string;
  createdAt: Date;
  workflowStatus: string;
  uploadedBy: { name: string };
  folder: { name: string } | null;
};

export function VaultDashboardClient({
  metrics,
  activity,
}: {
  metrics: Metrics;
  activity: ActivityDoc[];
}) {
  const chartData = metrics.byDepartment.map((d) => ({
    name: DEPARTMENT_LABELS[d.department].split(" ")[0],
    files: d.count,
  }));

  const statCards = [
    { label: "Total Documents", value: metrics.total, icon: FileText, accent: "border-l-primary" },
    { label: "Expiring Soon", value: metrics.expiring, icon: Clock, accent: "border-l-amber-500" },
    { label: "Recently Uploaded", value: metrics.recent, icon: Upload, accent: "border-l-emerald-500" },
    { label: "Pending Approvals", value: metrics.pendingApprovals, icon: CheckCircle2, accent: "border-l-orange-500" },
    { label: "Department Files", value: metrics.byDepartment.length, icon: Building2, accent: "border-l-sky-500" },
    { label: "Storage Usage", value: formatFileSize(metrics.storageBytes), icon: HardDrive, accent: "border-l-violet-500" },
    { label: "Shared Documents", value: metrics.shared, icon: Share2, accent: "border-l-pink-500" },
    { label: "Archived Files", value: metrics.archived, icon: Archive, accent: "border-l-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, accent }) => (
          <div
            key={label}
            className={`rounded-xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur-md ${accent} border-l-4`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
              </div>
              <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur-md lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Department-wise files</h2>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="files" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur-md lg:col-span-2">
          <h2 className="mb-4 font-semibold">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/documents/${doc.id}`}
                    className="block rounded-lg border border-border/50 p-3 transition hover:bg-muted/50"
                  >
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {doc.uploadedBy.name} · {doc.folder?.name ?? "Uncategorized"} ·{" "}
                      {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/documents/expiring"
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm transition hover:bg-amber-500/10"
        >
          <Clock className="mb-2 h-5 w-5 text-amber-600" />
          <p className="font-medium">Compliance alerts</p>
          <p className="mt-1 text-muted-foreground">FSSAI, GST, contracts & employee docs</p>
        </Link>
        <Link
          href="/documents/approvals"
          className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm transition hover:bg-primary/10"
        >
          <CheckCircle2 className="mb-2 h-5 w-5 text-primary" />
          <p className="font-medium">Approval queue</p>
          <p className="mt-1 text-muted-foreground">{metrics.pendingApprovals} awaiting review</p>
        </Link>
        <Link
          href="/documents/all?starred=1"
          className="rounded-xl border border-border/60 bg-card/80 p-4 text-sm transition hover:bg-muted/50"
        >
          <Star className="mb-2 h-5 w-5 text-gold-500" />
          <p className="font-medium">Favorites</p>
          <p className="mt-1 text-muted-foreground">Quick access to starred files</p>
        </Link>
      </div>
    </div>
  );
}
