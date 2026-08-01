"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { registerSchema } from "@/lib/validations";
import { dashboardPathForRole } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";

export type ActionState = {
  error?: string;
  success?: string;
};

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
