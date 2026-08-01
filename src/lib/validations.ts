import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["BUYER", "SELLER"]),
  phone: z.string().min(7).max(20).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const projectSchema = z.object({
  title: z.string().min(5).max(160),
  description: z.string().min(20).max(10000),
  budgetMin: z.coerce.number().positive(),
  budgetMax: z.coerce.number().positive(),
  category: z.string().max(80).optional().or(z.literal("")),
}).refine((d) => d.budgetMax >= d.budgetMin, {
  message: "Maximum budget must be at least the minimum",
  path: ["budgetMax"],
});

export const bidSchema = z.object({
  projectId: z.string().min(1),
  amount: z.coerce.number().positive(),
  proposal: z.string().min(20).max(5000),
  deliveryDays: z.coerce.number().int().min(1).max(365),
});

export const fundEscrowSchema = z.object({
  escrowId: z.string().min(1),
  channel: z.enum(["WEB", "ECOCASH", "ONEMONEY"]),
  phone: z.string().min(7).max(20).optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (data.channel !== "WEB" && !data.phone) {
    ctx.addIssue({
      code: "custom",
      message: "Phone number is required for mobile money",
      path: ["phone"],
    });
  }
});

export const withdrawalSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["ECOCASH", "ONEMONEY", "BANK"]),
  destination: z.string().min(5).max(200),
});

export const disputeSchema = z.object({
  escrowId: z.string().min(1),
  reason: z.string().min(20).max(5000),
});

export const disputeMessageSchema = z.object({
  disputeId: z.string().min(1),
  body: z.string().min(1).max(5000),
});
