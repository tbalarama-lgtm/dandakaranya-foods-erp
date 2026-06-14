"use client";

import { useState } from "react";
import { saveCatalog } from "@/lib/api";
import type { ShopCatalog, ShopProduct } from "@/types";

export function InventoryTable({ initial }: { initial: ShopCatalog }) {
  const [products, setProducts] = useState(initial.products);
  const [message, setMessage] = useState("");

  const toggleStock = async (product: ShopProduct) => {
    const next = products.map((p) =>
      p.id === product.id ? { ...p, inStock: !p.inStock } : p,
    );
    setProducts(next);
    const ok = await saveCatalog({ ...initial, products: next });
    setMessage(
      ok
        ? `${product.name} marked ${!product.inStock ? "in stock" : "out of stock"}.`
        : "Update failed.",
    );
    setTimeout(() => setMessage(""), 3000);
  };

  const out = products.filter((p) => !p.inStock);

  return (
    <div>
      {message && (
        <p className="mb-4 rounded-xl bg-forest-900 px-4 py-3 text-sm text-cream-50">{message}</p>
      )}
      {out.length > 0 && (
        <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {out.length} SKU{out.length > 1 ? "s" : ""} out of stock — restock or hide from shop.
        </p>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-forest-900/10 bg-cream-100 text-xs uppercase tracking-wider text-forest-700">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="hidden px-4 py-3 sm:table-cell">Unit</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-forest-900/5">
                <td className="px-4 py-3 font-medium text-forest-900">
                  <span className="mr-2" aria-hidden>
                    {p.emoji}
                  </span>
                  {p.name}
                </td>
                <td className="px-4 py-3 text-forest-900/70">{p.category}</td>
                <td className="hidden px-4 py-3 text-forest-900/70 sm:table-cell">{p.unit}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      p.inStock ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {p.inStock ? "In stock" : "Out of stock"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void toggleStock(p)}
                    className="text-xs font-semibold text-forest-700 hover:underline"
                  >
                    Toggle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
