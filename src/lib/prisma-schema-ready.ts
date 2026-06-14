import { Prisma } from "@prisma/client";

/** True when `prisma generate` has run with the procurement vendor schema. */
export function isProcurementVendorSchemaReady(): boolean {
  return "status" in Prisma.VendorScalarFieldEnum;
}

/** True when the generated client includes PO execution fields (poStatus, etc.). */
export function isPoExecutionClientSchemaReady(): boolean {
  return "poStatus" in Prisma.PurchaseScalarFieldEnum;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "";
}

function errorCode(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
  if (error && typeof error === "object" && "code" in error) return String((error as { code: unknown }).code);
  return "";
}

/** True for client validation issues and live DB schema drift (missing column/table). */
export function isPrismaValidationError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientValidationError) return true;

  const code = errorCode(error);
  if (code === "P2021" || code === "P2022") return true;

  const message = errorMessage(error);
  if (message.includes("Unknown field")) return true;
  if (message.includes("does not exist in the current database")) return true;
  if (message.includes("does not exist in the database")) return true;

  const name =
    error instanceof Error
      ? error.name
      : error && typeof error === "object" && "name" in error
        ? String((error as { name: unknown }).name)
        : "";

  return name === "PrismaClientValidationError" || name === "PrismaClientKnownRequestError";
}
