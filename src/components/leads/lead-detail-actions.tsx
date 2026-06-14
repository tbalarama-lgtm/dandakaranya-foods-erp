"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CommunicationChannel, LeadTaskStatus } from "@prisma/client";
import { FileText, Mail, MessageCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  addLeadCommunication,
  addLeadSample,
  addLeadTask,
  assignLead,
  autoAssignLead,
  completeLeadTask,
  sendLeadEmail,
  sendLeadWhatsApp,
  updateLeadTastingFeedback,
} from "@/actions/leads";
import { applyEmailTemplate, EMAIL_TEMPLATES } from "@/lib/crm-types";
import { toast } from "sonner";

type TaskRow = {
  id: string;
  title: string;
  status: LeadTaskStatus;
  dueAt: Date | null;
};

export function LeadDetailActions({
  leadId,
  products,
  assignees,
  currentAssigneeId,
  tasks,
  tastingFeedback,
  leadPhone,
  leadEmail,
  contactName,
}: {
  leadId: string;
  products: { id: string; name: string; salePrice: unknown }[];
  assignees: { id: string; name: string }[];
  currentAssigneeId: string | null;
  tasks: TaskRow[];
  tastingFeedback: string;
  leadPhone: string;
  leadEmail: string;
  contactName: string;
}) {
  const router = useRouter();
  const [commMsg, setCommMsg] = useState("");
  const [channel, setChannel] = useState<CommunicationChannel>("NOTE");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [sampleName, setSampleName] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [feedback, setFeedback] = useState(tastingFeedback);
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? "");
  const [sending, setSending] = useState(false);

  const productNames = products.map((p) => p.name).join(", ") || "our products";
  const assigneeName = assignees.find((a) => a.id === assigneeId)?.name ?? "Sales Team";

  const applyTemplate = (templateId: string) => {
    const t = EMAIL_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setEmailSubject(
      applyEmailTemplate(t.subject, { contact: contactName, assignee: assigneeName, products: productNames }),
    );
    setEmailBody(
      applyEmailTemplate(t.body, { contact: contactName, assignee: assigneeName, products: productNames }),
    );
    setWaMsg(
      applyEmailTemplate(t.body, { contact: contactName, assignee: assigneeName, products: productNames }),
    );
  };

  const pendingTasks = tasks.filter((t) => t.status === "PENDING");

  return (
    <div className="erp-kpi-card space-y-5 p-5">
      <h3 className="text-sm font-semibold">Quick actions</h3>

      <div>
        <Label className="text-xs">Assign to</Label>
        <select
          value={assigneeId}
          onChange={async (e) => {
            const next = e.target.value;
            setAssigneeId(next);
            await assignLead(leadId, next);
            toast.success("Assignee updated");
            router.refresh();
          }}
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-2 text-sm"
        >
          <option value="">Unassigned</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={async () => {
            await autoAssignLead(leadId);
            toast.success("Lead auto-assigned");
            router.refresh();
          }}
        >
          Auto-assign (balance workload)
        </Button>
      </div>

      <div>
        <Label className="text-xs">WhatsApp</Label>
        <textarea
          value={waMsg}
          onChange={(e) => setWaMsg(e.target.value)}
          rows={2}
          placeholder="Message to send via WhatsApp API or wa.me"
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2 w-full"
          disabled={!waMsg.trim() || sending}
          onClick={async () => {
            setSending(true);
            try {
              const result = await sendLeadWhatsApp(leadId, waMsg.trim());
              if (result.url) window.open(result.url, "_blank");
              toast.success(result.message);
              setWaMsg("");
              router.refresh();
            } catch {
              toast.error("WhatsApp send failed");
            } finally {
              setSending(false);
            }
          }}
        >
          <MessageCircle className="mr-1 h-3.5 w-3.5" />
          Send WhatsApp
        </Button>
        <p className="mt-1 text-[10px] text-muted-foreground">{leadPhone}</p>
      </div>

      <div>
        <Label className="text-xs">Email</Label>
        <input
          value={emailSubject}
          onChange={(e) => setEmailSubject(e.target.value)}
          placeholder="Subject"
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
        />
        <textarea
          value={emailBody}
          onChange={(e) => setEmailBody(e.target.value)}
          rows={3}
          placeholder="Email body"
          className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2 w-full"
          disabled={!emailBody.trim() || !leadEmail || sending}
          onClick={async () => {
            setSending(true);
            try {
              const result = await sendLeadEmail(leadId, emailSubject || "Enquiry", emailBody.trim());
              if (result.mailto) window.open(result.mailto, "_blank");
              toast.success(result.message);
              setEmailSubject("");
              setEmailBody("");
              router.refresh();
            } catch {
              toast.error("Email send failed");
            } finally {
              setSending(false);
            }
          }}
        >
          <Mail className="mr-1 h-3.5 w-3.5" />
          Send email
        </Button>
        {!leadEmail && <p className="mt-1 text-[10px] text-amber-600">No email on file</p>}
      </div>

      <div>
        <Label className="text-xs">Log activity</Label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as CommunicationChannel)}
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-2 text-sm"
        >
          {(["PHONE", "EMAIL", "WHATSAPP", "MEETING", "FOLLOW_UP", "QUOTATION", "NOTE"] as const).map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
        <textarea
          value={commMsg}
          onChange={(e) => setCommMsg(e.target.value)}
          rows={2}
          placeholder="Call notes, meeting summary…"
          className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
        <Button
          type="button"
          size="sm"
          className="mt-2 w-full"
          variant="secondary"
          onClick={async () => {
            if (!commMsg.trim()) return;
            await addLeadCommunication(leadId, channel, commMsg.trim());
            setCommMsg("");
            toast.success("Activity logged");
            router.refresh();
          }}
        >
          Save to timeline
        </Button>
      </div>

      <div>
        <Label className="text-xs">Tasks & reminders</Label>
        <input
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          placeholder="Follow up on quotation"
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
        />
        <input
          type="datetime-local"
          value={taskDue}
          onChange={(e) => setTaskDue(e.target.value)}
          className="mt-2 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2 w-full"
          onClick={async () => {
            if (!taskTitle.trim()) return;
            await addLeadTask(leadId, taskTitle.trim(), taskDue || undefined);
            setTaskTitle("");
            setTaskDue("");
            toast.success("Task created");
            router.refresh();
          }}
        >
          Add task
        </Button>
        {pendingTasks.length > 0 && (
          <ul className="mt-2 space-y-1">
            {pendingTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 shrink-0 px-2"
                  onClick={async () => {
                    await completeLeadTask(t.id);
                    toast.success("Task completed");
                    router.refresh();
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <Label className="text-xs">Request sample</Label>
        <input
          value={sampleName}
          onChange={(e) => setSampleName(e.target.value)}
          placeholder="Product name"
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2 w-full"
          onClick={async () => {
            if (!sampleName.trim()) return;
            await addLeadSample(leadId, { productName: sampleName.trim() });
            setSampleName("");
            toast.success("Sample request logged");
            router.refresh();
          }}
        >
          Log sample request
        </Button>
      </div>

      <div>
        <Label className="text-xs">Tasting feedback</Label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          placeholder="Sample tasting notes from buyer…"
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2 w-full"
          onClick={async () => {
            await updateLeadTastingFeedback(leadId, feedback);
            toast.success("Feedback saved");
            router.refresh();
          }}
        >
          Save tasting feedback
        </Button>
      </div>

      {products.length > 0 && (
        <Button type="button" size="sm" variant="premium" className="w-full" asChild>
          <Link href={`/quotations/new?leadId=${leadId}`}>
            <FileText className="mr-2 h-4 w-4" />
            Build quotation
          </Link>
        </Button>
      )}

      <div>
        <Label className="text-xs">Email templates</Label>
        <div className="mt-2 space-y-1">
          {EMAIL_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="block w-full rounded-lg bg-muted/40 px-3 py-2 text-left text-xs hover:bg-muted"
              onClick={() => {
                applyTemplate(t.id);
                toast.success(`Template "${t.name}" loaded`);
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
