/** Served from admin-dashboard/public/logo.png */
export const BRAND_LOGO_VERSION = "11";
export const BRAND_LOGO_LOCAL_SRC = "/logo.png";
export const BRAND_LOGO_PUBLIC_PATH = `/logo.png?v=${BRAND_LOGO_VERSION}`;

/** Production site logo (also used as default company profile URL). */
export const BRAND_LOGO_HTTPS_URL = `https://dandakaranyafoods.com/logo.png?v=${BRAND_LOGO_VERSION}`;

export function getAppLogoUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3001";
  return `${base}${BRAND_LOGO_PUBLIC_PATH}`;
}
