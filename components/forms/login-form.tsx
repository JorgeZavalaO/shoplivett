"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";

import { loginAction, type LoginActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const initialState: LoginActionState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-2">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Ingresando…
        </>
      ) : (
        "Iniciar sesión"
      )}
    </Button>
  );
}

type LoginFormProps = {
  from?: string;
  showSeedHint?: boolean;
  seedAccounts?: { email: string; password: string; label: string }[];
};

export function LoginForm({ from, showSeedHint, seedAccounts }: LoginFormProps) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <CardTitle>Shoplivett</CardTitle>
          <CardDescription>
            Accede para gestionar ventas, pagos y envíos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-3" noValidate>
            {from ? <input type="hidden" name="from" value={from} /> : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Correo
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@shoplivett.local"
                autoComplete="email"
                required
                aria-invalid={Boolean(state.fieldErrors?.email)}
              />
              {state.fieldErrors?.email ? (
                <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(state.fieldErrors?.password)}
              />
              {state.fieldErrors?.password ? (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.password}
                </p>
              ) : null}
            </div>
            {state.error && !state.fieldErrors ? (
              <p
                className={cn(
                  "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
                )}
              >
                {state.error}
              </p>
            ) : null}
            <SubmitButton />
          </form>
        </CardContent>
      </Card>

      {showSeedHint && seedAccounts && seedAccounts.length > 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Usuarios de desarrollo</CardTitle>
            <CardDescription className="text-xs">
              Solo visible fuera de producción. Credenciales sembradas por el seed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            {seedAccounts.map((acc) => (
              <div
                key={acc.email}
                className="flex items-center justify-between rounded-md border border-border bg-card px-2 py-1.5"
              >
                <div className="flex flex-col leading-tight">
                  <span className="font-medium">{acc.label}</span>
                  <span className="text-muted-foreground">{acc.email}</span>
                </div>
                <code className="rounded bg-muted px-1.5 py-0.5">{acc.password}</code>
              </div>
            ))}
            <p className="mt-1 text-muted-foreground">
              Configurados en <code>.env</code> (SEED_*).
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Link
        href="/"
        className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
