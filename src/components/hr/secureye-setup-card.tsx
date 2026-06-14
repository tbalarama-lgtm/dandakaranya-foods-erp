"use client";

import { Copy, ScanFace } from "lucide-react";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { Button } from "@/components/ui/button";
import { SECUREYE_S_AIF600 } from "@/lib/biometric/providers/secureye";
import { toast } from "sonner";

export function SecureyeSetupCard({ serverHost }: { serverHost: string }) {
  const port = typeof window !== "undefined" ? window.location.port || "3001" : "3001";
  const host = serverHost || (typeof window !== "undefined" ? window.location.hostname : "localhost");

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const steps = [
    {
      title: "Register device in ERP",
      body: "HR → Biometric → Add device. Provider: Secureye S-AIF600. Enter device Serial No (SN) from ONtime or device label.",
    },
    {
      title: "Network",
      body: `Connect S-AIF600 via Ethernet or Wi-Fi. Assign static IP (e.g. 192.168.1.210). ERP server must be reachable on LAN: ${host}:${port}`,
    },
    {
      title: "Cloud Server (ADMS push) — recommended",
      body: `On device menu: Communication → Cloud Server / ADMS. Server IP: ${host}, Port: ${port}, enable Push. Device will call /iclock/getrequest and push ATTLOG to /iclock/cdata`,
    },
    {
      title: "Map users",
      body: "Enroll face/finger on device — note each user's PIN (device user ID). Map PIN to employees in ERP (e.g. PIN 1 → EMP-001).",
    },
    {
      title: "ONtime SDK (optional)",
      body: "Use Secureye ONtime on a PC to export attendance or run their bridge; POST JSON to /api/v1/hr/biometric/webhook with X-Device-Key.",
    },
  ];

  return (
    <GlassCard glow="emerald" className="border-primary/20">
      <GlassCardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <ScanFace className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Secureye {SECUREYE_S_AIF600.model}</h3>
            <p className="text-xs text-muted-foreground">
              Wide dynamic face & fingerprint · {SECUREYE_S_AIF600.maxUsers} users · ADMS / ONtime
            </p>
          </div>
        </div>
      </GlassCardHeader>
      <GlassCardBody className="space-y-4">
        <div className="grid gap-2 rounded-xl bg-muted/40 p-3 text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">ADMS heartbeat</span>
            <p className="font-mono break-all">GET http://{host}:{port}/iclock/getrequest?SN=YOUR_SN</p>
          </div>
          <div>
            <span className="text-muted-foreground">Attendance push</span>
            <p className="font-mono break-all">POST http://{host}:{port}/iclock/cdata?SN=YOUR_SN&table=ATTLOG</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copy(`http://${host}:${port}/iclock/cdata`, "ADMS URL base")}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy server base URL
        </Button>
        <ol className="space-y-3 text-sm">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </GlassCardBody>
    </GlassCard>
  );
}
