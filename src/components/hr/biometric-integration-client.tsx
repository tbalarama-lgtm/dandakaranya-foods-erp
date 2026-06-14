"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Copy,
  Fingerprint,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  Plus,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { SelectField } from "@/components/ui/select-field";
import { MOCK_BIOMETRIC_DEVICES, MOCK_BIOMETRIC_PUNCHES } from "@/lib/hr/biometric-mock";
import type { BiometricDeviceView } from "@/lib/hr/biometric-mock";
import { MOCK_EMPLOYEES } from "@/lib/hr/mock-data";
import { SecureyeSetupCard } from "@/components/hr/secureye-setup-card";
import { toast } from "sonner";

const statusVariant: Record<string, "success" | "warning" | "danger" | "muted" | "default"> = {
  ONLINE: "success",
  OFFLINE: "muted",
  ERROR: "danger",
  SYNCING: "warning",
};

export function BiometricIntegrationClient() {
  const [devices, setDevices] = useState<BiometricDeviceView[]>([]);
  const [punches, setPunches] = useState<typeof MOCK_BIOMETRIC_PUNCHES>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [mapEmpId, setMapEmpId] = useState("");
  const [mapBioId, setMapBioId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newDevice, setNewDevice] = useState({
    name: "",
    provider: "SECUREYE_S_AIF600",
    ipAddress: "",
    port: "4370",
    serialNo: "",
  });

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/hr/biometric/webhook`
      : "/api/v1/hr/biometric/webhook";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devRes, punchRes] = await Promise.all([
        fetch("/api/v1/hr/biometric/devices"),
        fetch("/api/v1/hr/biometric/punches?limit=20"),
      ]);
      if (devRes.ok) {
        const j = await devRes.json();
        setDevices(j.data ?? []);
      } else {
        setDevices(MOCK_BIOMETRIC_DEVICES);
      }
      if (punchRes.ok) {
        const j = await punchRes.json();
        setPunches(j.data ?? []);
      } else {
        setPunches(MOCK_BIOMETRIC_PUNCHES);
      }
    } catch {
      setDevices(MOCK_BIOMETRIC_DEVICES);
      setPunches(MOCK_BIOMETRIC_PUNCHES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const syncDevice = async (deviceId?: string) => {
    setSyncing(deviceId ?? "all");
    try {
      const res = await fetch("/api/v1/hr/biometric/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Sync failed");
      toast.success("Biometric sync completed", {
        description: j.data?.results?.[0]?.errors?.[0] ?? "Attendance records updated",
      });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed — run db:push and seed");
    } finally {
      setSyncing(null);
    }
  };

  const addDevice = async () => {
    try {
      const res = await fetch("/api/v1/hr/biometric/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDevice.name,
          provider: newDevice.provider,
          ipAddress: newDevice.ipAddress || undefined,
          port: Number(newDevice.port) || 4370,
          serialNo: newDevice.serialNo || undefined,
        }),
      });
      if (!res.ok) throw new Error("Could not add device");
      toast.success("Device registered");
      setShowAdd(false);
      setNewDevice({ name: "", provider: "SECUREYE_S_AIF600", ipAddress: "", port: "4370", serialNo: "" });
      load();
    } catch {
      toast.error("Add device failed — ensure database is migrated");
    }
  };

  const mapEmployee = async () => {
    try {
      const res = await fetch("/api/v1/hr/biometric/map-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: mapEmpId, biometricUserId: mapBioId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Employee mapped to biometric ID");
      load();
    } catch {
      toast.error("Mapping failed");
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Fingerprint className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Biometric attendance integration</p>
            <p className="text-sm text-muted-foreground">Secureye S-AIF600 · ZKTeco · eSSL · ADMS push</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild size="sm">
            <Link href="/hr/attendance">← Daily attendance</Link>
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="mr-2 h-4 w-4" />
            Add device
          </Button>
          <Button size="sm" disabled={!!syncing} onClick={() => syncDevice()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync all
          </Button>
        </div>
      </div>

      <SecureyeSetupCard serverHost="" />

      {showAdd && (
        <GlassCard>
          <GlassCardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Device name</Label>
              <Input
                value={newDevice.name}
                onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                placeholder="Main gate ZK"
              />
            </div>
            <div>
              <Label>Provider</Label>
              <select
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={newDevice.provider}
                onChange={(e) => setNewDevice({ ...newDevice, provider: e.target.value })}
              >
                <option value="SECUREYE_S_AIF600">Secureye S-AIF600 (face + finger)</option>
                <option value="ZKTECO">ZKTeco</option>
                <option value="ESSL">eSSL</option>
                <option value="REALTIME">Realtime</option>
                <option value="GENERIC_WEBHOOK">Webhook only</option>
              </select>
            </div>
            <div>
              <Label>Serial no (SN) — required for ADMS</Label>
              <Input
                value={newDevice.serialNo}
                onChange={(e) => setNewDevice({ ...newDevice, serialNo: e.target.value })}
                placeholder="e.g. S-AIF600-XXXX"
              />
            </div>
            <div>
              <Label>IP address</Label>
              <Input
                value={newDevice.ipAddress}
                onChange={(e) => setNewDevice({ ...newDevice, ipAddress: e.target.value })}
                placeholder="192.168.1.201"
              />
            </div>
            <div>
              <Label>Port</Label>
              <Input
                value={newDevice.port}
                onChange={(e) => setNewDevice({ ...newDevice, port: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button onClick={addDevice}>Save device</Button>
            </div>
          </GlassCardBody>
        </GlassCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <GlassCardHeader>
            <h3 className="font-semibold">Webhook endpoint</h3>
            <p className="text-xs text-muted-foreground">Point your ZK agent or middleware here</p>
          </GlassCardHeader>
          <GlassCardBody className="space-y-3 text-sm">
            <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs break-all">{webhookUrl}</div>
            <Button variant="outline" size="sm" onClick={() => copy(webhookUrl, "Webhook URL")}>
              <Copy className="mr-2 h-4 w-4" />
              Copy URL
            </Button>
            <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-[10px]">
{`POST ${webhookUrl}
Headers:
  Content-Type: application/json
  X-Device-Key: <device-api-key>

Body:
{
  "punches": [
    { "deviceUserId": "1", "punchedAt": "2026-05-19T09:02:00", "direction": "IN" }
  ]
}`}
            </pre>
          </GlassCardBody>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <h3 className="font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Map employee ↔ device user ID
            </h3>
          </GlassCardHeader>
          <GlassCardBody className="space-y-3">
            <div>
              <Label>Employee</Label>
              <select
                id="map-employee-select"
                className="mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={mapEmpId}
                onChange={(e) => setMapEmpId(e.target.value)}
              >
                <option value="">Select…</option>
                {MOCK_EMPLOYEES.filter((e) => e.status === "ACTIVE").map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.employeeNo})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Biometric user ID (on device)</Label>
              <Input
                placeholder="e.g. 1, 10042"
                value={mapBioId}
                onChange={(e) => setMapBioId(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={!mapEmpId || !mapBioId} onClick={mapEmployee}>
              Save mapping
            </Button>
          </GlassCardBody>
        </GlassCard>
      </div>

      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">Registered devices</h3>
        </GlassCardHeader>
        <GlassCardBody className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading devices…</p>}
          {!loading && devices.length === 0 && (
            <p className="text-sm text-muted-foreground">No devices — add one or run db:seed</p>
          )}
          {devices.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex gap-3">
                {d.status === "ONLINE" ? (
                  <Wifi className="h-5 w-5 text-emerald-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.provider} · {d.ipAddress ?? "webhook"}:{d.port}
                    {d.branch?.name ? ` · ${d.branch.name}` : ""}
                  </p>
                  {d.lastError && <p className="text-xs text-destructive">{d.lastError}</p>}
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Key: {d.apiKey.slice(0, 12)}…
                    <button
                      type="button"
                      className="ml-2 text-primary"
                      onClick={() => copy(d.apiKey, "API key")}
                    >
                      Copy
                    </button>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[d.status] ?? "muted"}>{d.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={syncing === d.id}
                  onClick={() => syncDevice(d.id)}
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${syncing === d.id ? "animate-spin" : ""}`} />
                  Sync
                </Button>
              </div>
            </div>
          ))}
        </GlassCardBody>
      </GlassCard>

      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">Recent punch log</h3>
        </GlassCardHeader>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Device</th>
                <th className="px-4 py-2">User ID</th>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Dir</th>
                <th className="px-4 py-2">Processed</th>
              </tr>
            </thead>
            <tbody>
              {punches.map((p) => (
                <tr key={p.id} className="border-b border-border/40">
                  <td className="px-4 py-2">{new Date(p.punchedAt).toLocaleString()}</td>
                  <td className="px-4 py-2">{p.device?.name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono">{p.deviceUserId}</td>
                  <td className="px-4 py-2">
                    {p.employee ? `${p.employee.name} (${p.employee.employeeNo})` : "Unmapped"}
                  </td>
                  <td className="px-4 py-2">{p.direction ?? "—"}</td>
                  <td className="px-4 py-2">{p.processed ? "Yes" : "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCardBody>
      </GlassCard>

      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold flex items-center gap-2">
            <Server className="h-4 w-4" />
            Integration options
          </h3>
        </GlassCardHeader>
        <GlassCardBody className="grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-xl border p-4">
            <p className="font-medium">ZKTeco / eSSL (TCP)</p>
            <p className="mt-1 text-muted-foreground">
              Register device IP + port 4370. Use Sync or install a local agent that forwards punches to the webhook.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-medium">Webhook (recommended)</p>
            <p className="mt-1 text-muted-foreground">
              Any middleware (Python ZK pull, Node agent, C# eSSL bridge) POSTs JSON with X-Device-Key.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-medium">Environment</p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              BIOMETRIC_SHIFT_START_HOUR=9
              <br />
              BIOMETRIC_LATE_GRACE_MINUTES=15
              <br />
              BIOMETRIC_WEBHOOK_SECRET=optional
            </p>
          </div>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}
