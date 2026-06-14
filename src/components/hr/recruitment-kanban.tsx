"use client";

import { useRef, useState } from "react";
import type { Candidate, CandidateStage, JobOpening } from "@/lib/hr/types";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

const STAGES: CandidateStage[] = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"];

const stageLabels: Record<CandidateStage, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

export function RecruitmentKanban({
  jobs,
  initialCandidates,
}: {
  jobs: JobOpening[];
  initialCandidates: Candidate[];
}) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeCandidateRef = useRef<string | null>(null);

  const triggerUpload = (candidateId: string) => {
    activeCandidateRef.current = candidateId;
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const candidateId = activeCandidateRef.current;
    e.target.value = "";

    if (!file || !candidateId) return;

    setUploadingId(candidateId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/hr/recruitment/candidates/${encodeURIComponent(candidateId)}/resume`, {
        method: "POST",
        body: formData,
      });

      const body = (await res.json().catch(() => null)) as {
        error?: string;
        resumeUrl?: string;
        resumeFileName?: string;
      } | null;

      if (!res.ok) {
        throw new Error(body?.error ?? "Upload failed");
      }

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, resumeUrl: body?.resumeUrl, resumeFileName: body?.resumeFileName ?? file.name }
            : c,
        ),
      );
      toast.success(`Resume uploaded — ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resume upload failed");
    } finally {
      setUploadingId(null);
      activeCandidateRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={onFileSelected}
      />

      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">Job openings</h3>
        </GlassCardHeader>
        <GlassCardBody className="grid gap-3 sm:grid-cols-3">
          {jobs.map((j) => (
            <div key={j.id} className="rounded-xl border border-border/60 p-4">
              <p className="font-medium">{j.title}</p>
              <p className="text-xs text-muted-foreground">
                {j.department} · {j.location}
              </p>
              <p className="mt-2 text-sm">
                {j.openings} openings · <Badge variant={j.status === "OPEN" ? "success" : "muted"}>{j.status}</Badge>
              </p>
            </div>
          ))}
        </GlassCardBody>
      </GlassCard>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[1100px] gap-3">
          {STAGES.filter((s) => s !== "REJECTED").map((stage) => (
            <div key={stage} className="w-52 shrink-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {stageLabels[stage]}
              </p>
              <div className="min-h-[200px] space-y-2 rounded-xl bg-muted/30 p-2">
                {candidates
                  .filter((c) => c.stage === stage)
                  .map((c) => (
                    <div key={c.id} className="rounded-lg border border-border/60 bg-card p-3 shadow-sm">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.email}</p>
                      {c.interviewAt && (
                        <p className="mt-1 text-[10px] text-primary">
                          Interview: {new Date(c.interviewAt).toLocaleString()}
                        </p>
                      )}
                      {c.resumeUrl && (
                        <a
                          href={c.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          <span className="truncate">{c.resumeFileName ?? "View resume"}</span>
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 h-7 w-full text-xs"
                        disabled={uploadingId === c.id}
                        onClick={() => triggerUpload(c.id)}
                      >
                        {uploadingId === c.id ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Uploading…
                          </>
                        ) : (
                          <>
                            <Upload className="mr-1 h-3 w-3" />
                            {c.resumeUrl ? "Replace resume" : "Upload resume"}
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
