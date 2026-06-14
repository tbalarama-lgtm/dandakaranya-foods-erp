"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultCatalog } from "@/data/defaults";
import { fetchCatalog, saveCatalog } from "@/lib/api";
import type { ShopCatalog, ShopProduct } from "@/types";
import { Plus, Save, Trash2 } from "lucide-react";

function slugId(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `${base}-${Date.now().toString(36)}` : `product-${Date.now()}`;
}

const emptyProduct = (): ShopProduct => ({
  id: `product-${Date.now()}`,
  category: "Ingredients",
  emoji: "🫙",
  name: "",
  description: "",
  price: 0,
  unit: "1 unit",
  inStock: true,
  imageUrl: "",
});

export function ProductsManager({ initial }: { initial: ShopCatalog }) {
  const [catalog, setCatalog] = useState(initial);
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const persist = useCallback(async (next: ShopCatalog) => {
    setSaving(true);
    const ok = await saveCatalog(next);
    setSaving(false);
    setMessage(ok ? "Saved to Supabase — live on website shop." : "Save failed. Check Supabase env vars.");
    if (ok) setCatalog(next);
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    fetchCatalog().then((cloud) => {
      if (cloud?.products?.length) setCatalog(cloud);
    });
  }, []);

  const saveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const product = {
      ...editing,
      name: editing.name.trim(),
      description: editing.description.trim(),
    };
    if (!product.name) return;

    const exists = catalog.products.some((p) => p.id === product.id);
    const products = exists
      ? catalog.products.map((p) => (p.id === product.id ? product : p))
      : [...catalog.products, product];
    void persist({ ...catalog, products });
    setEditing(null);
  };

  const deleteProduct = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    void persist({ ...catalog, products: catalog.products.filter((p) => p.id !== id) });
  };

  const categories = [...new Set(catalog.products.map((p) => p.category))];

  return (
    <div>
      {message && (
        <p className="mb-4 rounded-xl bg-forest-900 px-4 py-3 text-sm font-medium text-cream-50">
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-forest-900/60">{catalog.products.length} products in catalogue</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(emptyProduct())} className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            Add product
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void persist(catalog)}
            className="btn-secondary"
          >
            <Save className="h-4 w-4" aria-hidden />
            {saving ? "Saving…" : "Sync to shop"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset to built-in catalogue defaults?")) {
                void persist(defaultCatalog);
                setEditing(null);
              }
            }}
            className="btn-secondary text-red-800"
          >
            Reset defaults
          </button>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {catalog.products.map((product) => (
          <li
            key={product.id}
            className="card flex flex-wrap items-center gap-4 p-4"
          >
            <span className="text-2xl" aria-hidden>
              {product.emoji}
            </span>
            {product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt=""
                className="h-14 w-14 rounded-lg bg-cream-100 object-contain p-1"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-forest-900">{product.name}</p>
              <p className="text-xs text-forest-900/60">
                {product.category} · ₹{product.price > 0 ? product.price : "On request"} · {product.unit}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                product.inStock ? "bg-green-100 text-green-800" : "bg-forest-900/10 text-forest-700"
              }`}
            >
              {product.inStock ? "In stock" : "Out of stock"}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing({ ...product })} className="btn-secondary py-1.5 text-xs">
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteProduct(product.id, product.name)}
                className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <form onSubmit={saveProduct} className="card mt-8 space-y-4 p-6">
          <h2 className="font-display text-xl font-semibold text-forest-900">
            {catalog.products.some((p) => p.id === editing.id) ? "Edit product" : "New product"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Name</span>
              <input
                value={editing.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setEditing((prev) => {
                    if (!prev) return prev;
                    const isNew = !catalog.products.some((p) => p.id === prev.id);
                    return { ...prev, name, id: isNew && name ? slugId(name) : prev.id };
                  });
                }}
                className="input"
                required
              />
            </label>
            <label>
              <span className="label">Category</span>
              <input
                list="cat-list"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                className="input"
                required
              />
              <datalist id="cat-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="label">Emoji</span>
              <input
                value={editing.emoji}
                onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
                className="input"
                maxLength={4}
              />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Image URL</span>
              <input
                value={editing.imageUrl ?? ""}
                onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })}
                className="input"
                placeholder="/images/tamarind-powder.png"
              />
            </label>
            <label>
              <span className="label">Price (INR, 0 = on request)</span>
              <input
                type="number"
                min={0}
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) || 0 })}
                className="input"
              />
            </label>
            <label>
              <span className="label">Unit</span>
              <input
                value={editing.unit}
                onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                className="input"
                required
              />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Description</span>
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={3}
                className="input"
                required
              />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={editing.inStock}
                onChange={(e) => setEditing({ ...editing, inStock: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">In stock</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Save product
            </button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

