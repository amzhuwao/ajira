import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MobileUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

const TOKEN_TTL = "7d";

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function signMobileToken(user: MobileUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .setIssuer("ajira-mobile")
    .setAudience("ajira-app")
    .sign(secretKey());
}

export async function verifyMobileToken(token: string): Promise<MobileUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "ajira-mobile",
      audience: "ajira-app",
    });
    const id = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const name = typeof payload.name === "string" ? payload.name : null;
    const role = payload.role as Role | undefined;
    if (!id || !email || !name || !role) return null;
    return { id, email, name, role };
  } catch {
    return null;
  }
}

export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export async function requireMobileAuth(
  request: Request,
  roles?: Role[],
): Promise<MobileUser> {
  const token = bearerFromRequest(request);
  if (!token) {
    throw new MobileAuthError(401, "Missing authorization token");
  }
  const claims = await verifyMobileToken(token);
  if (!claims) {
    throw new MobileAuthError(401, "Invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.id },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
  if (!user) {
    throw new MobileAuthError(401, "User not found");
  }
  if (user.status === "SUSPENDED" || user.status === "BANNED") {
    throw new MobileAuthError(403, `Account is ${user.status.toLowerCase()}`);
  }
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    throw new MobileAuthError(403, "Insufficient permissions");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export class MobileAuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "MobileAuthError";
  }
}

export function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  bio?: string | null;
  tagline?: string | null;
  skills?: string | null;
  kycVerified?: boolean;
  status?: string;
  createdAt?: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone ?? null,
    bio: user.bio ?? null,
    tagline: user.tagline ?? null,
    skills: user.skills ?? null,
    kycVerified: user.kycVerified ?? false,
    status: user.status ?? "ACTIVE",
    createdAt: user.createdAt?.toISOString() ?? undefined,
  };
}
