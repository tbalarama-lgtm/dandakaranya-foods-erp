import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { Employee, EmploymentType, EmployeeStatus } from "@/lib/hr/types";
import { MOCK_EMPLOYEES } from "@/lib/hr/mock-data";
import { normalizeAadhaar } from "@/lib/hr/employee-validation";

const STORE_PATH = join(process.cwd(), "data", "hr-employees.json");

async function readStore(): Promise<Record<string, Employee>> {
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, Employee>;
  } catch {
    return {};
  }
}

async function writeStore(map: Record<string, Employee>) {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(map, null, 2), "utf-8");
}

export async function listEmployees(): Promise<Employee[]> {
  const store = await readStore();
  const byId = new Map<string, Employee>(MOCK_EMPLOYEES.map((e) => [e.id, e]));
  for (const e of Object.values(store)) {
    byId.set(e.id, e);
  }
  return Array.from(byId.values());
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const store = await readStore();
  if (store[id]) return store[id];
  return MOCK_EMPLOYEES.find((e) => e.id === id) ?? null;
}

export async function saveEmployee(employee: Employee) {
  const store = await readStore();
  store[employee.id] = employee;
  await writeStore(store);
}

export async function removeEmployeeFromStore(id: string) {
  const store = await readStore();
  if (!store[id]) return false;
  delete store[id];
  await writeStore(store);
  return true;
}

export function parseEmployeeFormData(formData: FormData): Omit<Employee, "id" | "photoUrl"> {
  const employmentType = String(formData.get("employmentType") ?? "FULL_TIME") as EmploymentType;
  const status = String(formData.get("status") ?? "ACTIVE") as EmployeeStatus;

  return {
    employeeNo: String(formData.get("employeeNo") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    department: String(formData.get("department") ?? "").trim(),
    designation: String(formData.get("designation") ?? "").trim(),
    joinedAt: String(formData.get("joinedAt") ?? "").trim(),
    salary: Number(formData.get("salary") ?? 0),
    employmentType,
    shift: String(formData.get("shift") ?? "General"),
    status,
    branchName: String(formData.get("branchName") ?? "Sukma HQ").trim() || "Sukma HQ",
    bankAccountName: String(formData.get("bankAccountName") ?? "").trim() || undefined,
    bankName: String(formData.get("bankName") ?? "").trim() || undefined,
    bankAccountNumber: String(formData.get("bankAccountNumber") ?? "").trim() || undefined,
    bankIfsc: String(formData.get("bankIfsc") ?? "").trim() || undefined,
    bankBranch: String(formData.get("bankBranch") ?? "").trim() || undefined,
    aadhaarNumber: (() => {
      const raw = String(formData.get("aadhaarNumber") ?? "").trim();
      return raw ? normalizeAadhaar(raw) : undefined;
    })(),
    aadhaarAuthorized: formData.get("aadhaarAuthorized") === "true",
    aadhaarAuthorizedAt: undefined,
  };
}

export function resolveAadhaarAuthorization(
  parsed: ReturnType<typeof parseEmployeeFormData>,
  existing?: Employee | null,
): Pick<Employee, "aadhaarAuthorized" | "aadhaarAuthorizedAt" | "aadhaarNumber"> {
  const aadhaarNumber = parsed.aadhaarNumber
    ? parsed.aadhaarNumber.replace(/\s+/g, "")
    : undefined;

  if (!parsed.aadhaarAuthorized) {
    return { aadhaarNumber, aadhaarAuthorized: false, aadhaarAuthorizedAt: undefined };
  }

  const wasAuthorized = Boolean(existing?.aadhaarAuthorized);
  const sameNumber = existing?.aadhaarNumber === aadhaarNumber;
  if (wasAuthorized && sameNumber && existing?.aadhaarAuthorizedAt) {
    return {
      aadhaarNumber,
      aadhaarAuthorized: true,
      aadhaarAuthorizedAt: existing.aadhaarAuthorizedAt,
    };
  }

  return {
    aadhaarNumber,
    aadhaarAuthorized: true,
    aadhaarAuthorizedAt: new Date().toISOString(),
  };
}
