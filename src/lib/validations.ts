import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["BUYER", "SELLER"]),
  phone: z.string().min(7).max(20).optional().or(z.literal("")),
  acceptTerms: z
    .string()
    .refine((v) => v === "on", { message: "You must accept the Terms and Privacy Policy" }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  password: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const projectSchema = z.object({
  title: z.string().min(5).max(160),
  description: z.string().min(20).max(10000),
  budgetMin: z.coerce.number().positive(),
  budgetMax: z.coerce.number().positive(),
  category: z.string().max(80).optional().or(z.literal("")),
  timeline: z.enum(["URGENT", "SHORT", "MEDIUM", "FLEXIBLE"]).default("FLEXIBLE"),
  screeningQuestions: z.string().max(2000).optional().or(z.literal("")),
}).refine((d) => d.budgetMax >= d.budgetMin, {
  message: "Maximum budget must be at least the minimum",
  path: ["budgetMax"],
});

export const bidSchema = z.object({
  projectId: z.string().min(1),
  amount: z.coerce.number().positive(),
  proposal: z.string().min(20).max(5000),
  deliveryDays: z.coerce.number().int().min(1).max(365),
  portfolioUrl: z.string().url().max(500).optional().or(z.literal("")),
  screeningAnswers: z.string().max(5000).optional().or(z.literal("")),
});

export const messageSchema = z.object({
  projectId: z.string().min(1),
  body: z.string().min(1).max(5000),
});

export const inviteSchema = z.object({
  projectId: z.string().min(1),
  sellerId: z.string().min(1),
  message: z.string().max(1000).optional().or(z.literal("")),
});

export const milestonePlanSchema = z.object({
  escrowId: z.string().min(1),
  milestonesJson: z.string().min(2).max(10000),
});

export const orderServiceSchema = z.object({
  serviceId: z.string().min(1),
  notes: z.string().max(2000).optional().or(z.literal("")),
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

export const disputeSplitSchema = z.object({
  disputeId: z.string().min(1),
  buyerSharePercent: z.coerce.number().min(1).max(99),
  note: z.string().min(5).max(2000),
});

export const reviewSchema = z.object({
  projectId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().or(z.literal("")),
});

export const reviewReplySchema = z.object({
  reviewId: z.string().min(1),
  replyText: z.string().min(2).max(2000),
});

export const sellerProfileSchema = z.object({
  tagline: z.string().max(160).optional().or(z.literal("")),
  bio: z.string().max(5000).optional().or(z.literal("")),
  skills: z.string().max(500).optional().or(z.literal("")),
  availability: z.enum(["AVAILABLE", "BUSY", "UNAVAILABLE"]),
  profileImageUrl: z.string().url().max(500).optional().or(z.literal("")),
  coverImageUrl: z.string().url().max(500).optional().or(z.literal("")),
});

export const serviceSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(10).max(5000),
  price: z.coerce.number().positive(),
  category: z.string().max(80).optional().or(z.literal("")),
  deliveryDays: z.coerce.number().int().min(1).max(365).default(7),
  deliverables: z.string().max(2000).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "DRAFT", "PAUSED"]),
});

export const adminCreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["BUYER", "SELLER", "ADMIN"]),
  phone: z.string().min(7).max(20).optional().or(z.literal("")),
});

export const adminUpdateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["BUYER", "SELLER", "ADMIN"]),
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
  kycVerified: z.enum(["true", "false"]).optional(),
  phone: z.string().min(7).max(20).optional().or(z.literal("")),
  password: z
    .string()
    .max(100)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || v.length >= 8, {
      message: "Password must be at least 8 characters",
    }),
});

export const platformSettingsSchema = z.object({
  commission_percentage: z.coerce.number().min(0).max(50),
  refund_fee_percentage: z.coerce.number().min(0).max(50),
  min_escrow_amount: z.coerce.number().min(0),
  max_transaction_amount: z.coerce.number().positive(),
  auto_release_days: z.coerce.number().int().min(1).max(90),
  dispute_resolution_days: z.coerce.number().int().min(1).max(90),
  kyc_required_for_seller: z.enum(["true", "false"]),
  maintenance_mode: z.enum(["true", "false"]),
  tos_text: z.string().max(20000),
  privacy_text: z.string().max(20000),
});
