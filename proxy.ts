import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/clientes",
  "/productos",
  "/categorias",
  "/inventario",
  "/lives",
  "/ventas",
  "/pedidos",
  "/pagos",
  "/envios",
  "/reportes",
  "/auditoria",
  "/lotes",
  "/gastos",
  "/incidencias",
  "/configuracion",
];

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => nextUrl.pathname === prefix || nextUrl.pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) return NextResponse.next();

  if (!session?.user) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("from", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
