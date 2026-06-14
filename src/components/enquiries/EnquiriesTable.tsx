"use client";

import { useState } from "react";
import { formatDate } from "@/lib/currency";
import { fetchEnquiries, updateEnquiryStatus } from "@/lib/api";
import type { B2BEnquiry } from "@/types";

const pipeline = ["new", "contacted", "quoted", "won", "lost"] as const;

export function EnquiriesTable({ initial }: { initial: B2BEnquiry[] }) {
  const [enquiries, setEnquiries] = useState(initial);

  const changeStatus = async (id: string, status: string) => {
    const ok = await updateEnquiryStatus(id, status);
    if (ok) setEnquiries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  };

  if (enquiries.length === 0) {
    return <p className="text-sm text-forest-900/50">No B2B enquiries yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {enquiries.map((e) => (
        <li key={e.id} className="card p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-forest-900">{e.company}</p>
              <p className="text-xs text-forest-900/55">
                {e.contactName} · {e.email} · {e.phone}
              </p>
              <p className="text-xs text-forest-900/45">{formatDate(e.createdAt)}</p>
            </div>
            <select
              value={e.status}
              onChange={(ev) => void changeStatus(e.id, ev.target.value)}
              className="input max-w-[140px] py-1.5 text-xs"
            >
              {pipeline.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {e.products && <p className="mt-2 text-forest-900/70">Products: {e.products}</p>}
          {e.volume && <p className="text-forest-900/70">Volume: {e.volume}</p>}
          {e.message && <p className="mt-1 text-forest-900/60">{e.message}</p>}
        </li>
      ))}
    </ul>
  );
}
