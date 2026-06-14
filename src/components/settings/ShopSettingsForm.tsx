"use client";

import { useState } from "react";
import { fetchCatalog, saveCatalog } from "@/lib/api";
import type { ShopCatalog, ShopSettings } from "@/types";

export function ShopSettingsForm({ initial }: { initial: ShopCatalog }) {
  const [catalog, setCatalog] = useState(initial);
  const [form, setForm] = useState(initial.settings);
  const [message, setMessage] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = { ...catalog, settings: form };
    const ok = await saveCatalog(next);
    setMessage(ok ? "Shop settings saved." : "Save failed.");
    if (ok) setCatalog(next);
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <form onSubmit={(e) => void save(e)} className="card max-w-2xl space-y-4 p-6">
      {message && <p className="rounded-xl bg-forest-900 px-4 py-2 text-sm text-cream-50">{message}</p>}
      {(
        [
          ["badge", "Badge"],
          ["title", "Title"],
          ["titleAccent", "Title accent"],
          ["description", "Description"],
          ["whatsapp", "WhatsApp (country code, no +)"],
          ["email", "Email"],
          ["note", "Cart note"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          <span className="label">{label}</span>
          {key === "description" || key === "note" ? (
            <textarea
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              rows={key === "description" ? 3 : 2}
              className="input"
            />
          ) : (
            <input
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="input"
            />
          )}
        </label>
      ))}
      <button type="submit" className="btn-primary">
        Save settings
      </button>
      <button
        type="button"
        className="btn-secondary ml-2"
        onClick={() => void fetchCatalog().then((c) => c && setForm(c.settings))}
      >
        Reload from cloud
      </button>
    </form>
  );
}
