# Shoplivett

Administrador interno de ventas para una tienda de carteras que vende principalmente por **TikTok Live**: clientes, productos, variantes, stock, reservas, pagos (Yape/Plin), envíos agrupados, créditos y reportes.

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript estricto
- Tailwind CSS 4 + shadcn/ui (base-nova)
- Prisma 7 + Neon PostgreSQL
- Auth.js v5 (Credentials) con sesión JWT en cookie httpOnly
- React Hook Form + Zod
- Vercel Blob (Sprint 4+)
- Sonner, Lucide React

## Requisitos

- Node.js 20+
- pnpm 10+
- Una base de datos PostgreSQL en Neon (o local)

## Configuración local

1. Instala dependencias:

   ```bash
   pnpm install
   ```

2. Copia las variables de entorno y completa los valores:

   ```bash
   cp .env.example .env
   ```

   Variables mínimas a completar:

   - `DATABASE_URL` y `DIRECT_URL` (Neon)
   - `AUTH_SECRET` (genera con `openssl rand -base64 32`)
   - `SEED_ADMIN_PASSWORD`, `SEED_SELLER_PASSWORD`, `SEED_DISPATCH_PASSWORD`

3. Aplica el schema y crea los usuarios seed:

   ```bash
   pnpm db:push
   pnpm db:seed
   ```

4. Inicia el servidor de desarrollo:

   ```bash
   pnpm dev
   ```

   Abre [http://localhost:3000](http://localhost:3000); serás redirigido a `/login`.

## Credenciales seed

Por defecto, el seed crea tres usuarios (solo para desarrollo):

| Rol | Email | Contraseña |
| --- | --- | --- |
| Administrador | `admin@shoplivett.local` | `SEED_ADMIN_PASSWORD` |
| Vendedora | `seller@shoplivett.local` | `SEED_SELLER_PASSWORD` |
| Despacho | `dispatch@shoplivett.local` | `SEED_DISPATCH_PASSWORD` |

> ⚠️ No uses estas credenciales en producción. En `NODE_ENV=production` el panel "Usuarios de desarrollo" no se muestra en `/login`.

## Scripts disponibles

| Script | Descripción |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo (Turbopack). |
| `pnpm build` | Build de producción. |
| `pnpm start` | Inicia el build de producción. |
| `pnpm lint` | ESLint sobre el proyecto. |
| `pnpm db:generate` | Genera el cliente Prisma. |
| `pnpm db:push` | Aplica el schema a la base de datos. |
| `pnpm db:migrate` | Crea/aplica migraciones con historial. |
| `pnpm db:studio` | Abre Prisma Studio. |
| `pnpm db:seed` | Crea los usuarios seed (idempotente). |

## Estructura

```
app/
  (auth)/login/        Página de inicio de sesión
  (dashboard)/         Rutas protegidas (layout valida sesión)
  api/auth/[...nextauth]/  Handler de Auth.js
auth.ts                Configuración de Auth.js v5
middleware.ts          Protección de rutas
actions/               Server actions (auth, etc.)
components/            UI, layout, forms, tables, dashboard
lib/                   auth, prisma, validations, permissions, blob, utils
prisma/                schema.prisma y seed
types/                 Enums compartidos del dominio
```

## Estado de sprints

- ✅ Sprint 0 — Base técnica
- ✅ Sprint 1 — Autenticación, usuarios y roles
- ⏳ Sprint 2 — Configuración del negocio
- ⏳ Sprints 3–15 — ver `docs/PLAN_DESARROLLO_SPRINTS.md`
