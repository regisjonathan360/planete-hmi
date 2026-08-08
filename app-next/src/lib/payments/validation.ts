import { z } from "zod";

export const paymentProviderSchema = z.enum([
  "moncash",
  "natcash",
  "paypal",
  "mannitoks",
  "remitly",
  "western_union",
  "taptap_send",
  "other",
]);

export const paymentStatusSchema = z.enum([
  "DRAFT",
  "PENDING",
  "PENDING_REVIEW",
  "PROCESSING",
  "CONFIRMED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]);

export const contributionInputSchema = z.object({
  amount: z.coerce.number().finite().positive().max(1_000_000),
  currency: z.enum(["HTG", "USD"]),
  provider: paymentProviderSchema,
  donorName: z.string().trim().max(120).optional().default(""),
  donorEmail: z.union([z.literal(""), z.email().max(254)]).optional().default(""),
  donorPhone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().max(1000).optional().default(""),
  anonymous: z.boolean().optional().default(false),
  idempotencyKey: z.string().uuid(),
});

export const manualConfirmationSchema = z.object({
  reference: z.string().regex(/^HMI-[A-Z0-9]{6}-[A-Z0-9]{10}$/),
  transactionCode: z.string().trim().min(3).max(160),
  amount: z.coerce.number().finite().positive().max(1_000_000),
  donorName: z.string().trim().max(120).optional().default(""),
  donorPhone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().max(1000).optional().default(""),
});

export const contributionReferenceSchema = z
  .string()
  .regex(/^HMI-[A-Z0-9]{6}-[A-Z0-9]{10}$/);

export const adminContributionQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: paymentStatusSchema.optional(),
  provider: paymentProviderSchema.optional(),
  currency: z.enum(["HTG", "USD"]).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const reviewContributionSchema = z.object({
  status: z.enum(["CONFIRMED", "REJECTED", "PENDING_REVIEW"]),
  reason: z.string().trim().min(3).max(2000),
  internalNotes: z.string().trim().max(2000).optional().default(""),
});
