import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { JWT } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";
import { LoginSchema } from "@/lib/validations";
import type { Role } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

type AppJWT = JWT & {
  id?: string;
  role?: Role;
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = LoginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user || !user.isActive) return null;

        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        if (!passwordOk) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const t = token as AppJWT;
      if (user) {
        t.id = (user as { id: string }).id;
        t.role = (user as { role: Role }).role;
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as AppJWT;
      if (t && session.user) {
        session.user.id = t.id ?? session.user.id;
        session.user.role = t.role ?? session.user.role;
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard")
        || request.nextUrl.pathname.startsWith("/clientes")
        || request.nextUrl.pathname.startsWith("/productos")
        || request.nextUrl.pathname.startsWith("/inventario")
        || request.nextUrl.pathname.startsWith("/lives")
        || request.nextUrl.pathname.startsWith("/ventas")
        || request.nextUrl.pathname.startsWith("/pedidos")
        || request.nextUrl.pathname.startsWith("/pagos")
        || request.nextUrl.pathname.startsWith("/envios")
        || request.nextUrl.pathname.startsWith("/reportes")
        || request.nextUrl.pathname.startsWith("/configuracion");

      if (isOnDashboard) return !!session?.user;
      return true;
    },
  },
});
