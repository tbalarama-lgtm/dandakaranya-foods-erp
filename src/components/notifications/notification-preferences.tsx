"use client";

import { useEffect, useState } from "react";
import { Mail, MessageSquare, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getNotificationPreferencesAction,
  updateNotificationPreferences,
} from "@/actions/notifications";
import {
  DEFAULT_CATEGORY_PREFS,
  NOTIFICATION_TABS,
  type NotificationPreferenceDto,
} from "@/lib/notification-types";
import type { NotificationCategory } from "@prisma/client";
import { toast } from "sonner";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function NotificationPreferencesPanel({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<NotificationPreferenceDto>({
    email: true,
    sms: false,
    push: true,
    criticalOnly: false,
    categories: DEFAULT_CATEGORY_PREFS,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getNotificationPreferencesAction().then((next) => {
      if (active) setPrefs(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateNotificationPreferences(prefs);
      toast.success("Notification preferences saved");
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (cat: NotificationCategory) => {
    setPrefs((p) => ({
      ...p,
      categories: { ...p.categories, [cat]: !p.categories[cat] },
    }));
  };

  return (
    <div className="erp-kpi-card border border-[#B68D40]/20 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">Delivery preferences</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Email, SMS, and push channels · category filters · critical-only mode
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" strokeWidth={ICON_STROKE} />
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          { key: "email" as const, label: "Email", icon: Mail },
          { key: "sms" as const, label: "SMS", icon: MessageSquare },
          { key: "push" as const, label: "Push / in-app", icon: Smartphone },
        ].map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[#B68D40]" strokeWidth={ICON_STROKE} />
              <Label htmlFor={`pref-${key}`}>{label}</Label>
            </div>
            <Switch
              id={`pref-${key}`}
              checked={prefs[key]}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Critical alerts only</p>
          <p className="text-xs text-muted-foreground">Suppress info and success notifications</p>
        </div>
        <Switch
          checked={prefs.criticalOnly}
          onCheckedChange={(v) => setPrefs((p) => ({ ...p, criticalOnly: v }))}
        />
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Category subscriptions
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {NOTIFICATION_TABS.filter((t) => t.category).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleCategory(t.category!)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                prefs.categories[t.category!]
                  ? "bg-[#B68D40]/20 text-[#967235] dark:text-[#C9A55A]"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="button" variant="premium" disabled={saving} onClick={save}>
          Save preferences
        </Button>
      </div>
    </div>
  );
}
