import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations";
import {
  MobileAuthError,
  publicUser,
  requireMobileAuth,
  signMobileToken,
} from "@/lib/mobile/auth";
import {
  handleMobileError,
  jsonOk,
  readJsonBody,
} from "@/lib/mobile/http";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, we sent a password reset link.";

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function mobileLogin(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return handleMobileError(
        new MobileAuthError(400, parsed.error.issues[0]?.message ?? "Invalid input"),
      );
    }

    const email = parsed.data.email.toLowerCase();
    if (!rateLimit(`mobile-login:${email}`, 10, 60_000)) {
      return handleMobileError(
        new MobileAuthError(429, "Too many login attempts. Try again in a minute."),
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return handleMobileError(new MobileAuthError(401, "Invalid email or password."));
    }
    if (user.status === "SUSPENDED") {
      return handleMobileError(
        new MobileAuthError(403, "This account is suspended. Contact support."),
      );
    }
    if (user.status === "BANNED") {
      return handleMobileError(new MobileAuthError(403, "This account has been banned."));
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return handleMobileError(new MobileAuthError(401, "Invalid email or password."));
    }

    const token = await signMobileToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return jsonOk({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileRegister(request: Request) {
  try {
    const body = await readJsonBody<{
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      phone?: string;
      acceptTerms?: boolean | string;
    }>(request);

    const parsed = registerSchema.safeParse({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      role: body.role ?? "BUYER",
      phone: body.phone ?? "",
      acceptTerms: body.acceptTerms === true || body.acceptTerms === "on" ? "on" : "",
    });
    if (!parsed.success) {
      return handleMobileError(
        new MobileAuthError(400, parsed.error.issues[0]?.message ?? "Invalid input"),
      );
    }

    const email = parsed.data.email.toLowerCase();
    if (!rateLimit(`mobile-register:${email}`, 5, 300_000)) {
      return handleMobileError(
        new MobileAuthError(429, "Too many registration attempts. Try again later."),
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return handleMobileError(
        new MobileAuthError(409, "An account with this email already exists."),
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        role: parsed.data.role,
        phone: parsed.data.phone || null,
        ...(parsed.data.role === "SELLER" ? { wallet: { create: {} } } : {}),
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

    const token = await signMobileToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return jsonOk({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileMe(request: Request) {
  try {
    const authUser = await requireMobileAuth(request);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: authUser.id },
    });
    return jsonOk({ user: publicUser(user) });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileForgotPassword(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return handleMobileError(
        new MobileAuthError(400, parsed.error.issues[0]?.message ?? "Invalid email"),
      );
    }

    const email = parsed.data.email.toLowerCase();
    if (!rateLimit(`mobile-forgot:${email}`, 5, 300_000)) {
      return handleMobileError(
        new MobileAuthError(429, "Too many reset requests. Try again later."),
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return jsonOk({ message: GENERIC_RESET_MESSAGE });
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
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
      return handleMobileError(
        new MobileAuthError(502, "Could not send the reset email. Please try again shortly."),
      );
    }

    return jsonOk({ message: GENERIC_RESET_MESSAGE });
  } catch (err) {
    return handleMobileError(err);
  }
}

export async function mobileResetPassword(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return handleMobileError(
        new MobileAuthError(400, parsed.error.issues[0]?.message ?? "Invalid input"),
      );
    }

    const tokenHash = hashResetToken(parsed.data.token);
    if (!rateLimit(`mobile-reset:${tokenHash}`, 10, 300_000)) {
      return handleMobileError(
        new MobileAuthError(429, "Too many attempts. Request a new reset link."),
      );
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return handleMobileError(
        new MobileAuthError(
          400,
          "This reset link is invalid or has expired. Request a new one.",
        ),
      );
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

    return jsonOk({ message: "Password updated. You can sign in now." });
  } catch (err) {
    return handleMobileError(err);
  }
}
