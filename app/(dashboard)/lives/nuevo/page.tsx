import { createLiveAction } from "@/actions/lives";
import { LiveForm } from "@/components/forms/live-form";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";


export default async function NuevoLivePage() {
  await requireRole(["ADMIN", "SELLER"]);
  const responsibles = await getPrisma().user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "SELLER"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo live</h1>
        <p className="text-sm text-muted-foreground">
          Solo puede existir un live abierto al mismo tiempo.
        </p>
      </div>
      <LiveForm
        mode="create"
        action={createLiveAction}
        cancelHref="/lives"
        responsibles={responsibles}
      />
    </div>
  );
}
