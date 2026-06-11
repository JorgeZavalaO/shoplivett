"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LiveStatus } from "@prisma/client";
import type { ZodIssue } from "zod";

import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import {
  LiveError,
  assertCanOpenLive,
  getLiveDetail,
  listLiveSessions,
} from "@/lib/live";
import {
  LiveSessionCreateSchema,
  LiveSessionUpdateSchema,
  type LiveSessionCreateInput,
} from "@/lib/validations";

export type LiveActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof LiveSessionCreateInput, string>>;
};

function fieldErrorsFromZod(
  issues: ZodIssue[],
): LiveActionResult["fieldErrors"] {
  const out: LiveActionResult["fieldErrors"] = {};
  for (const issue of issues) {
    const key = issue.path[0] as keyof LiveSessionCreateInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    channel: String(formData.get("channel") ?? "TIKTOK").trim(),
    responsibleId: String(formData.get("responsibleId") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function createLiveAction(
  _prev: LiveActionResult | undefined,
  formData: FormData,
): Promise<LiveActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  const parsed = LiveSessionCreateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await assertCanOpenLive();
  } catch (error) {
    if (error instanceof LiveError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  const prisma = getPrisma();
  const live = await prisma.liveSession.create({
    data: {
      name: parsed.data.name,
      channel: parsed.data.channel,
      responsibleId: parsed.data.responsibleId ?? null,
      notes: parsed.data.notes ?? null,
      status: "OPEN",
    },
  });

  revalidatePath("/lives");
  redirect(`/lives/${live.id}`);
}

export async function updateLiveAction(
  liveId: string,
  _prev: LiveActionResult | undefined,
  formData: FormData,
): Promise<LiveActionResult> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!liveId) return { ok: false, message: "Falta el identificador del live." };

  const parsed = LiveSessionUpdateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const prisma = getPrisma();
  const existing = await prisma.liveSession.findUnique({ where: { id: liveId } });
  if (!existing) return { ok: false, message: "El live ya no existe." };
  if (existing.status !== "OPEN") {
    return {
      ok: false,
      message: "Solo puedes editar un live que esté abierto.",
    };
  }

  await prisma.liveSession.update({
    where: { id: liveId },
    data: {
      name: parsed.data.name,
      channel: parsed.data.channel,
      responsibleId: parsed.data.responsibleId ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  revalidatePath("/lives");
  revalidatePath(`/lives/${liveId}`);
  redirect(`/lives/${liveId}`);
}

export async function closeLiveAction(liveId: string): Promise<void> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!liveId) return;
  const prisma = getPrisma();
  const live = await prisma.liveSession.findUnique({ where: { id: liveId } });
  if (!live) {
    throw new LiveError("El live ya no existe.", "LIVE_NOT_FOUND");
  }
  if (live.status === "CLOSED") {
    throw new LiveError("El live ya está cerrado.", "LIVE_ALREADY_CLOSED");
  }
  if (live.status === "CANCELLED") {
    throw new LiveError(
      "No puedes cerrar un live cancelado.",
      "LIVE_ALREADY_CANCELLED",
    );
  }
  await prisma.liveSession.update({
    where: { id: liveId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  revalidatePath("/lives");
  revalidatePath(`/lives/${liveId}`);
}

export async function cancelLiveAction(liveId: string): Promise<void> {
  await requireRole(["ADMIN", "SELLER"]);
  if (!liveId) return;
  const prisma = getPrisma();
  const live = await prisma.liveSession.findUnique({ where: { id: liveId } });
  if (!live) {
    throw new LiveError("El live ya no existe.", "LIVE_NOT_FOUND");
  }
  if (live.status === "CANCELLED") {
    throw new LiveError(
      "El live ya está cancelado.",
      "LIVE_ALREADY_CANCELLED",
    );
  }
  await prisma.liveSession.update({
    where: { id: liveId },
    data: { status: "CANCELLED", closedAt: live.closedAt ?? new Date() },
  });
  revalidatePath("/lives");
  revalidatePath(`/lives/${liveId}`);
}

export async function getLiveSessionsAction(args?: {
  query?: string;
  status?: LiveStatus | "ALL";
  page?: number;
  perPage?: number;
}) {
  await requireRole(["ADMIN", "SELLER"]);
  return listLiveSessions(args);
}

export async function getLiveDetailAction(liveId: string) {
  await requireRole(["ADMIN", "SELLER"]);
  return getLiveDetail(liveId);
}
