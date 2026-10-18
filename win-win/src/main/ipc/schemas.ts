import { z } from "zod";

export const idSchema = z.object({ id: z.string().min(1) });
export const namedSchema = z.object({
  name: z.string().min(1),
  nameTe: z.string().optional(),
  officialCode: z.string().nullable().optional(),
  notes: z.string().optional()
});
export const constituencyScope = z.object({
  constituencyId: z.string().min(1),
  boundaryVersionId: z.string().min(1)
});
export const voterFilters = z.object({
  constituencyId: z.string().min(1),
  wardId: z.string().nullable().optional(),
  rollEditionId: z.string().nullable().optional(),
  verificationStatus: z.enum(["unverified", "verified", "needs_review", ""]).optional(),
  query: z.string().optional(),
  unassignedOnly: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(200).optional()
});
export const mappingSchema = z.object({
  nameOriginal: z.string().optional(),
  nameEnglish: z.string().optional(),
  electoralId: z.string().optional(),
  rollSerial: z.string().optional(),
  publishedAge: z.string().optional(),
  ageReferenceDate: z.string().optional(),
  publishedAddress: z.string().optional(),
  wardNumber: z.string().optional(),
  sourceSection: z.string().optional(),
  sourcePage: z.string().optional()
});
