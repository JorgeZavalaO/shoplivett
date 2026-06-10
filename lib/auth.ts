// Configuración de Auth.js.
// Sprint 1 implementará el provider, sesión y helpers.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {},
  providers: [],
} as const;
