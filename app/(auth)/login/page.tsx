import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

type SearchParams = Promise<{ from?: string | string[] }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { from } = await searchParams;
  const fromValue = Array.isArray(from) ? from[0] : from;
  const safeFrom = fromValue && fromValue.startsWith("/") ? fromValue : undefined;

  const showSeedHint = process.env.NODE_ENV !== "production";
  const seedAccounts = showSeedHint
    ? [
        {
          label: "Administrador",
          email: process.env.SEED_ADMIN_EMAIL ?? "admin@shoplivett.local",
          password: process.env.SEED_ADMIN_PASSWORD ?? "(definir en .env)",
        },
        {
          label: "Vendedora",
          email: process.env.SEED_SELLER_EMAIL ?? "seller@shoplivett.local",
          password: process.env.SEED_SELLER_PASSWORD ?? "(definir en .env)",
        },
        {
          label: "Despacho",
          email: process.env.SEED_DISPATCH_EMAIL ?? "dispatch@shoplivett.local",
          password: process.env.SEED_DISPATCH_PASSWORD ?? "(definir en .env)",
        },
      ]
    : undefined;

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/30 p-4">
      <LoginForm from={safeFrom} showSeedHint={showSeedHint} seedAccounts={seedAccounts} />
    </div>
  );
}
