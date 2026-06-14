import { cookies } from "next/headers";

const SESSION_COOKIE = "df_admin_session";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function hasAdminSession(): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { createClient } = await import("./supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) return true;
  }

  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value === "1";
}

export function getAdminCredentials() {
  return {
    email: process.env.ADMIN_EMAIL ?? "admin@dandakaranyafoods.com",
    password: process.env.ADMIN_PASSWORD ?? "",
  };
}

export { SESSION_COOKIE };
