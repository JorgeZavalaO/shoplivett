import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// =====================================================================
// Rate limit para login
// =====================================================================

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

function isLoginWindowExpired(windowStart: Date, now: Date): boolean {
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

  if (row && isLoginWindowExpired(row.windowStart, now)) {
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
      if (!row || isLoginWindowExpired(row.windowStart, now)) {
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

// =====================================================================
// Rate limit generalizado (API routes)
// =====================================================================

export type ApiRateLimitOpts = {
  windowMs?: number;
  maxHits?: number;
  blockMs?: number;
};

export type ApiRateLimitParams = {
  scope: string;
  key: string;
  opts?: ApiRateLimitOpts;
};

const DEFAULT_API_WINDOW_MS = 60_000;
const DEFAULT_API_MAX_HITS = 30;

/**
 * Verifica si una API key/scope ha excedido el límite de requests.
 * Retorna un NextResponse si debe denegarse, o null si puede continuar.
 */
export async function assertApiRateLimit(
  params: ApiRateLimitParams,
): Promise<NextResponse | null> {
  const windowMs = params.opts?.windowMs ?? DEFAULT_API_WINDOW_MS;
  const maxHits = params.opts?.maxHits ?? DEFAULT_API_MAX_HITS;
  const blockMs = params.opts?.blockMs ?? windowMs;

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  try {
    await prisma.$transaction(async (tx) => {
      // Limpiar ventanas antiguas
      await tx.apiRateLimit.deleteMany({
        where: {
          scope: params.scope,
          key: params.key,
          windowStart: { lt: windowStart },
        },
      });

      const row = await tx.apiRateLimit.findUnique({
        where: { scope_key: { scope: params.scope, key: params.key } },
      });

      if (row?.blockedUntil && row.blockedUntil > now) {
        throw new ApiRateLimitBlocked();
      }

      if (!row || row.windowStart < windowStart) {
        await tx.apiRateLimit.upsert({
          where: { scope_key: { scope: params.scope, key: params.key } },
          create: {
            scope: params.scope,
            key: params.key,
            hits: 1,
            windowStart: now,
          },
          update: {
            hits: 1,
            windowStart: now,
            blockedUntil: null,
          },
        });
        return;
      }

      const newHits = row.hits + 1;
      const blockedUntil =
        newHits > maxHits ? new Date(now.getTime() + blockMs) : null;

      await tx.apiRateLimit.update({
        where: { id: row.id },
        data: {
          hits: newHits,
          blockedUntil,
        },
      });

      if (blockedUntil) {
        throw new ApiRateLimitBlocked();
      }
    });
  } catch (error) {
    if (error instanceof ApiRateLimitBlocked) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(blockMs / 1000)),
        },
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }

  return null;
}

class ApiRateLimitBlocked extends Error {
  constructor() {
    super("Rate limit exceeded");
    this.name = "ApiRateLimitBlocked";
  }
}

/**
 * Extrae una key de rate-limit a partir del actor autenticado o la IP.
 */
export function apiRateKeyFromRequest(request: Request, actorId?: string | null): string {
  if (actorId) return hashPart(`user:${actorId}`);
  const ip = getClientIp(request);
  return hashPart(`ip:${ip}`);
}
