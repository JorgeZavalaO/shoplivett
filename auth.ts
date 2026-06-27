import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { JWT } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";
import { LoginSchema } from "@/lib/validations/auth";
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

// Cualquier valor distinto de "false" se considera confiable. Por defecto
// (variable ausente) se confía en el host. Esto cubre Vercel, Neon y otros
// proxies sin requerir configuración explícita.
const trustHost = process.env.AUTH_TRUST_HOST !== "false";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost,
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
    async jwt({ token, user, trigger }) {
      const t = token as AppJWT;
      if (user) {
        t.id = (user as { id: string }).id;
        t.role = (user as { role: Role }).role;
        return t;
      }
      // Refresca rol y estado activo en cada refresh/update de sesión.
      // Limita el costo a una sola consulta cuando el JWT ya tiene un id.
      if (t.id && (trigger === "update" || !t.role)) {
        const fresh = await prisma.user.findUnique({
          where: { id: t.id },
          select: { role: true, isActive: true },
        });
        if (!fresh || !fresh.isActive) {
          // Forzamos un JWT vacío para que la sesión quede inválida.
          return { ...t, id: "", role: undefined } as AppJWT;
        }
        t.role = fresh.role;
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as AppJWT;
      if (!t.id || !t.role) {
        // Devuelve una sesión vacía cuando el JWT fue invalidado.
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (t && session.user) {
        session.user.id = t.id;
        session.user.role = t.role;
      }
      return session;
    },
  },
});
