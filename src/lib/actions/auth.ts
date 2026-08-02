"use server";

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import {
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations";
import { dashboardPathForRole } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";

export type ActionState = {
  error?: string;
  success?: string;
};

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, we sent a password reset link.";

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? "BUYER"),
    phone: String(formData.get("phone") ?? ""),
    acceptTerms: formData.get("acceptTerms") === "on" ? "on" : "",
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  if (!rateLimit(`register:${email}`, 5, 300_000)) {
    return { error: "Too many registration attempts. Try again later." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      role: parsed.data.role,
      phone: parsed.data.phone || null,
      ...(parsed.data.role === "SELLER"
        ? { wallet: { create: {} } }
        : {}),
    },
  });

  try {
    const { sendWelcomeEmail } = await import("@/lib/mail");
    await sendWelcomeEmail({
      to: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    console.error("Welcome email failed", err);
  }

  await signIn("credentials", {
    email: user.email,
    password: parsed.data.password,
    redirect: false,
  });

  redirect(dashboardPathForRole(user.role));
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!rateLimit(`login:${email}`, 10, 60_000)) {
    return { error: "Too many login attempts. Try again in a minute." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.status === "SUSPENDED") {
    return { error: "This account is suspended. Contact support." };
  }
  if (existing?.status === "BANNED") {
    return { error: "This account has been banned." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  redirect(dashboardPathForRole(user?.role ?? "BUYER"));
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const email = parsed.data.email.toLowerCase();
  if (!rateLimit(`forgot:${email}`, 5, 300_000)) {
    return { error: "Too many reset requests. Try again later." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { success: GENERIC_RESET_MESSAGE };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ajira.online";
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  try {
    const { sendPasswordResetEmail } = await import("@/lib/mail");
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });
  } catch (err) {
    console.error("Password reset email failed", err);
    return {
      error: "Could not send the reset email. Please try again shortly.",
    };
  }

  return { success: GENERIC_RESET_MESSAGE };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tokenHash = hashResetToken(parsed.data.token);
  if (!rateLimit(`reset:${tokenHash}`, 10, 300_000)) {
    return { error: "Too many attempts. Request a new reset link." };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return {
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: record.userId,
        id: { not: record.id },
        usedAt: null,
      },
    }),
  ]);

  redirect("/login?reset=1");
}
