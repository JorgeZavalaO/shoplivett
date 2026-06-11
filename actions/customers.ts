"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { ZodIssue } from "zod";

import { requireUser } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { normalizeForSearch, normalizeWhatsApp } from "@/lib/phone";

export async function getCustomerAction(customerId: string) {
  await requireUser();
  if (!customerId) return null;
  return getPrisma().customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, whatsapp: true },
  });
}
import {
  CustomerCreateSchema,
  CustomerUpdateSchema,
  type CustomerCreateInput,
} from "@/lib/validations";
import {
  type CustomerActionResult,
  type CustomerListResult,
  initialCustomerState,
} from "@/lib/customers-types";

const PERU_DIAL_REGEX = /^\+51\d{9}$/;

function fieldErrorsFromZod(
  issues: ZodIssue[],
): CustomerActionResult["fieldErrors"] {
  const out: CustomerActionResult["fieldErrors"] = {};
  for (const issue of issues) {
    const key = issue.path[0] as keyof CustomerCreateInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim(),
    document: String(formData.get("document") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    district: String(formData.get("district") ?? "").trim(),
    reference: String(formData.get("reference") ?? "").trim(),
    channel: String(formData.get("channel") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function createCustomerAction(
  _prev: CustomerActionResult | undefined,
  formData: FormData,
): Promise<CustomerActionResult> {
  await requireUser();

  const parsed = CustomerCreateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const whatsapp = normalizeWhatsApp(parsed.data.whatsapp);
  if (!whatsapp || !PERU_DIAL_REGEX.test(whatsapp)) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: { whatsapp: "Ingresa un WhatsApp válido (9 dígitos, empieza con 9)." },
    };
  }

  const prisma = getPrisma();
  const existing = await prisma.customer.findUnique({ where: { whatsapp } });
  if (existing) {
    return {
      ok: false,
      message: "Ya existe una clienta con ese WhatsApp.",
      fieldErrors: { whatsapp: "Este WhatsApp ya está registrado." },
      whatsappNormalized: whatsapp,
    };
  }

  const customer = await prisma.customer.create({
    data: {
      name: parsed.data.name,
      searchName: normalizeForSearch(parsed.data.name),
      whatsapp,
      document: parsed.data.document ?? null,
      address: parsed.data.address ?? null,
      district: parsed.data.district ?? null,
      reference: parsed.data.reference ?? null,
      channel: parsed.data.channel ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${customer.id}`);
}

export async function updateCustomerAction(
  customerId: string,
  _prev: CustomerActionResult | undefined,
  formData: FormData,
): Promise<CustomerActionResult> {
  await requireUser();
  if (!customerId) {
    return { ok: false, message: "Falta el identificador de la clienta." };
  }

  const parsed = CustomerUpdateSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const whatsapp = normalizeWhatsApp(parsed.data.whatsapp);
  if (!whatsapp || !PERU_DIAL_REGEX.test(whatsapp)) {
    return {
      ok: false,
      message: "Revisa los datos del formulario.",
      fieldErrors: { whatsapp: "Ingresa un WhatsApp válido (9 dígitos, empieza con 9)." },
    };
  }

  const prisma = getPrisma();
  const existing = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!existing) {
    return { ok: false, message: "La clienta ya no existe." };
  }

  if (existing.whatsapp !== whatsapp) {
    const conflict = await prisma.customer.findUnique({ where: { whatsapp } });
    if (conflict && conflict.id !== customerId) {
      return {
        ok: false,
        message: "Ya existe otra clienta con ese WhatsApp.",
        fieldErrors: { whatsapp: "Este WhatsApp ya está registrado." },
        whatsappNormalized: whatsapp,
      };
    }
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: parsed.data.name,
      searchName: normalizeForSearch(parsed.data.name),
      whatsapp,
      document: parsed.data.document ?? null,
      address: parsed.data.address ?? null,
      district: parsed.data.district ?? null,
      reference: parsed.data.reference ?? null,
      channel: parsed.data.channel ?? null,
      notes: parsed.data.notes ?? null,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${customerId}`);
  redirect(`/clientes/${customerId}`);
}

export async function setCustomerStatusAction(
  customerId: string,
  status: "ACTIVE" | "FREQUENT" | "RISKY" | "BLOCKED",
): Promise<void> {
  await requireUser();
  if (!customerId) return;

  const prisma = getPrisma();
  await prisma.customer.update({
    where: { id: customerId },
    data: { status },
  });
  revalidatePath(`/clientes/${customerId}`);
  revalidatePath("/clientes");
}

export async function deactivateCustomerAction(
  customerId: string,
): Promise<void> {
  await requireUser();
  if (!customerId) return;
  const prisma = getPrisma();
  await prisma.customer.update({
    where: { id: customerId },
    data: { isActive: false },
  });
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${customerId}`);
  redirect("/clientes");
}

export async function searchCustomersAction(
  query: string,
  page = 1,
  perPage = 20,
): Promise<CustomerListResult> {
  await requireUser();
  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.min(100, Math.max(1, Math.floor(perPage)));
  const trimmed = query.trim();

  const prisma = getPrisma();
  const where: Prisma.CustomerWhereInput = {
    isActive: true,
    ...(trimmed
      ? {
          OR: [
            { searchName: { contains: normalizeForSearch(trimmed) } },
            { name: { contains: trimmed, mode: "insensitive" } },
            { whatsapp: { contains: trimmed.replace(/\D/g, "") } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      select: {
        id: true,
        name: true,
        whatsapp: true,
        status: true,
        isActive: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    items: rows,
    total,
    page: safePage,
    perPage: safePerPage,
    query: trimmed,
  };
}

void initialCustomerState;
