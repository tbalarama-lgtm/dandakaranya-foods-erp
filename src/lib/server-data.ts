import { defaultCatalog } from "@/data/defaults";
import type { B2BEnquiry, ShopCatalog, ShopOrder } from "@/types";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./auth";

export async function getCatalog(): Promise<ShopCatalog> {
  if (!isSupabaseConfigured()) return defaultCatalog;
  const supabase = await createClient();
  const { data } = await supabase.from("shop_catalog").select("data").eq("id", 1).maybeSingle();
  if (data?.data?.products?.length) return data.data as ShopCatalog;
  return defaultCatalog;
}

export async function getOrders(): Promise<ShopOrder[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!data) return [];
  return data.map((row) => ({
    id: row.id,
    items: row.items,
    customer: row.customer,
    total: Number(row.total),
    status: row.status,
    paymentId: row.payment_id ?? undefined,
    channel: row.channel,
    createdAt: row.created_at,
  }));
}

export async function getEnquiries(): Promise<B2BEnquiry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_enquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!data) return [];
  return data.map((row) => ({
    id: row.id,
    type: row.type,
    company: row.company,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    products: row.products ?? "",
    volume: row.volume ?? "",
    message: row.message ?? "",
    status: row.status ?? "new",
    createdAt: row.created_at,
  }));
}
