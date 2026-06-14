import type { B2BEnquiry, ShopCatalog, ShopOrder } from "@/types";
import { createClient, isSupabaseConfigured } from "./supabase/client";

export async function fetchCatalog(): Promise<ShopCatalog | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shop_catalog")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data?.data?.products) return null;
  return data.data as ShopCatalog;
}

export async function saveCatalog(catalog: ShopCatalog): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = createClient();
  const { error } = await supabase.from("shop_catalog").upsert({
    id: 1,
    data: catalog,
    updated_at: new Date().toISOString(),
  });
  return !error;
}

export async function fetchOrders(): Promise<ShopOrder[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data.map(mapOrder);
}

export async function updateOrderStatus(
  id: string,
  status: ShopOrder["status"],
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = createClient();
  const { error } = await supabase.from("shop_orders").update({ status }).eq("id", id);
  return !error;
}

export async function fetchEnquiries(): Promise<B2BEnquiry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shop_enquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map(mapEnquiry);
}

export async function updateEnquiryStatus(id: string, status: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = createClient();
  const { error } = await supabase.from("shop_enquiries").update({ status }).eq("id", id);
  return !error;
}

function mapOrder(row: Record<string, unknown>): ShopOrder {
  return {
    id: String(row.id),
    items: row.items as ShopOrder["items"],
    customer: row.customer as ShopOrder["customer"],
    total: Number(row.total),
    status: String(row.status) as ShopOrder["status"],
    paymentId: row.payment_id ? String(row.payment_id) : undefined,
    channel: row.channel as ShopOrder["channel"],
    createdAt: String(row.created_at),
  };
}

function mapEnquiry(row: Record<string, unknown>): B2BEnquiry {
  return {
    id: String(row.id),
    type: String(row.type ?? "b2b"),
    company: String(row.company),
    contactName: String(row.contact_name),
    email: String(row.email),
    phone: String(row.phone),
    products: String(row.products ?? ""),
    volume: String(row.volume ?? ""),
    message: String(row.message ?? ""),
    status: String(row.status ?? "new"),
    createdAt: String(row.created_at),
  };
}

export function computeStats(
  orders: ShopOrder[],
  enquiries: B2BEnquiry[],
  catalog: ShopCatalog | null,
) {
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "whatsapp").length;
  const paidRevenue = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.total, 0);
  const newEnquiries = enquiries.filter((e) => e.status === "new").length;
  const outOfStock = catalog?.products.filter((p) => !p.inStock).length ?? 0;

  return {
    totalOrders: orders.length,
    pendingOrders,
    paidRevenue,
    newEnquiries,
    outOfStock,
    productCount: catalog?.products.length ?? 0,
  };
}
