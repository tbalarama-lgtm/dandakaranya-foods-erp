"use client";

import { useState } from "react";
import { formatDate, formatInr } from "@/lib/currency";
import { fetchOrders, updateOrderStatus } from "@/lib/api";
import type { ShopOrder } from "@/types";

const statuses: ShopOrder["status"][] = [
  "pending",
  "paid",
  "whatsapp",
  "shipped",
  "cancelled",
];

export function OrdersTable({ initial }: { initial: ShopOrder[] }) {
  const [orders, setOrders] = useState(initial);

  const refresh = async () => {
    const next = await fetchOrders();
    setOrders(next);
  };

  const changeStatus = async (id: string, status: ShopOrder["status"]) => {
    const ok = await updateOrderStatus(id, status);
    if (ok) setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  if (orders.length === 0) {
    return <p className="text-sm text-forest-900/50">No orders yet.</p>;
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => void refresh()} className="btn-secondary text-xs">
        Refresh
      </button>
      <ul className="space-y-3">
        {orders.map((order) => (
          <li key={order.id} className="card p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-forest-900">
                  {order.customer.name || "Guest"} · {formatInr(order.total)}
                </p>
                <p className="text-xs text-forest-900/55">{formatDate(order.createdAt)}</p>
              </div>
              <select
                value={order.status}
                onChange={(e) => void changeStatus(order.id, e.target.value as ShopOrder["status"])}
                className="input max-w-[140px] py-1.5 text-xs"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-forest-900/70">
              {order.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}
            </p>
            <p className="mt-1 text-xs text-forest-900/50">
              {order.customer.phone} · {order.customer.address || "—"} · {order.channel}
            </p>
            {order.paymentId && (
              <p className="mt-1 text-xs text-forest-700">Payment: {order.paymentId}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
