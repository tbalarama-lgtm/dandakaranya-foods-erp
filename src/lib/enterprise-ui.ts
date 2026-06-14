/** Consistent Lucide icon sizing across the ERP shell. */
export const ICON = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
} as const;

export const ICON_STROKE = 1.75;

/** Enterprise spacing scale (Tailwind-aligned). */
export const SPACE = {
  page: "space-y-8",
  section: "space-y-6",
  stack: "space-y-4",
  inline: "gap-3",
} as const;

export const ERP_COLORS = {
  bg: "#071226",
  sidebar: "#08182F",
  hover: "#102544",
  gold: "#B68D40",
  goldLight: "#C9A55A",
  text: "#E5E7EB",
  muted: "#94A3B8",
} as const;
