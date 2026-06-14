export type ShopProduct = {
  id: string;
  category: string;
  emoji: string;
  imageUrl?: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  inStock: boolean;
};

export type ShopSettings = {
  badge: string;
  title: string;
  titleAccent: string;
  description: string;
  whatsapp: string;
  email: string;
  note: string;
};

export type ShopCatalog = {
  products: ShopProduct[];
  settings: ShopSettings;
};

export type OrderLine = {
  product: ShopProduct;
  quantity: number;
};

export type OrderCustomer = {
  name: string;
  phone: string;
  address: string;
  email?: string;
};

export type ShopOrder = {
  id: string;
  items: OrderLine[];
  customer: OrderCustomer;
  total: number;
  status: "pending" | "paid" | "whatsapp" | "shipped" | "cancelled";
  paymentId?: string;
  channel: "whatsapp" | "razorpay";
  createdAt: string;
};

export type B2BEnquiry = {
  id: string;
  type: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  products: string;
  volume: string;
  message: string;
  status: string;
  createdAt: string;
};

export type DashboardStats = {
  totalOrders: number;
  pendingOrders: number;
  paidRevenue: number;
  newEnquiries: number;
  outOfStock: number;
  productCount: number;
};
