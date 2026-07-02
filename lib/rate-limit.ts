import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILED_ATTEMPTS = 5;

export type LoginRateLimitToken = {
  key: string;
};

export class LoginRateLimitError extends Error {
  constructor() {
    super("Demasiados intentos fallidos. Intenta nuevamente mas tarde.");
    this.name = "LoginRateLimitError";
  }
}

function hashPart(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

function loginKey(email: string, request: Request): string {
  const normalizedEmail = email.trim().toLowerCase();
  const ip = getClientIp(request);
  return hashPart(`${normalizedEmail}:${ip}`);
}

function isWindowExpired(windowStart: Date, now: Date): boolean {
  return now.getTime() - windowStart.getTime() >= LOGIN_WINDOW_MS;
}

export async function assertLoginAllowed(args: {
  email: string;
  request: Request;
}): Promise<LoginRateLimitToken> {
  const key = loginKey(args.email, args.request);
  const row = await prisma.loginRateLimit.findUnique({ where: { key } });
  const now = new Date();

  if (row?.blockedUntil && row.blockedUntil > now) {
    throw new LoginRateLimitError();
  }

  if (row && isWindowExpired(row.windowStart, now)) {
    await prisma.loginRateLimit.update({
      where: { key },
      data: { failedAttempts: 0, windowStart: now, blockedUntil: null },
    });
  }

  return { key };
}

export async function recordLoginFailure(token: LoginRateLimitToken): Promise<void> {
  const now = new Date();
  const blockUntil = new Date(now.getTime() + LOGIN_BLOCK_MS);

  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.loginRateLimit.findUnique({ where: { key: token.key } });
      if (!row || isWindowExpired(row.windowStart, now)) {
        await tx.loginRateLimit.upsert({
          where: { key: token.key },
          create: { key: token.key, failedAttempts: 1, windowStart: now },
          update: { failedAttempts: 1, windowStart: now, blockedUntil: null },
        });
        return;
      }

      const failedAttempts = row.failedAttempts + 1;
      await tx.loginRateLimit.update({
        where: { key: token.key },
        data: {
          failedAttempts,
          blockedUntil:
            failedAttempts >= LOGIN_MAX_FAILED_ATTEMPTS ? blockUntil : row.blockedUntil,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return;
    }
    throw error;
  }
}

export async function clearLoginFailures(token: LoginRateLimitToken): Promise<void> {
  await prisma.loginRateLimit.deleteMany({ where: { key: token.key } });
}
