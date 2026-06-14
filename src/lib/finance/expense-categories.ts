import type { ExpenseCategory } from "@prisma/client";

/** UI labels shown in forms */
export const EXPENSE_CATEGORY_OPTIONS = [
  { label: "Salaries", value: "LABOR" as ExpenseCategory },
  { label: "Raw Materials", value: "RAW_MATERIAL" as ExpenseCategory },
  { label: "Utilities", value: "UTILITIES" as ExpenseCategory },
  { label: "Transportation", value: "LOGISTICS" as ExpenseCategory },
  { label: "Packaging", value: "OTHER" as ExpenseCategory },
  { label: "Marketing", value: "MARKETING" as ExpenseCategory },
  { label: "Office Expenses", value: "OTHER" as ExpenseCategory },
] as const;

const enumToLabel: Record<ExpenseCategory, string> = {
  RAW_MATERIAL: "Raw Materials",
  LABOR: "Salaries",
  UTILITIES: "Utilities",
  LOGISTICS: "Transportation",
  MARKETING: "Marketing",
  OTHER: "Other",
};

export function categoryToLabel(category: ExpenseCategory, reference?: string | null): string {
  if (category === "OTHER" && reference?.startsWith("packaging:")) return "Packaging";
  if (category === "OTHER" && reference?.startsWith("office:")) return "Office Expenses";
  return enumToLabel[category] ?? category;
}

export function uiCategoryToPrisma(
  label: string,
  department?: string,
): { category: ExpenseCategory; reference: string | null } {
  const opt = EXPENSE_CATEGORY_OPTIONS.find((o) => o.label === label);
  const category = opt?.value ?? "OTHER";
  let reference: string | null = department ?? null;
  if (label === "Packaging") reference = `packaging:${department ?? "general"}`;
  if (label === "Office Expenses") reference = `office:${department ?? "general"}`;
  else if (department) reference = department;
  return { category, reference };
}
