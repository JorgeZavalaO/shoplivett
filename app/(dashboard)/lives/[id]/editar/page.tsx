import { notFound, redirect } from "next/navigation";

import { updateLiveAction } from "@/actions/lives";
import { LiveForm } from "@/components/forms/live-form";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";


type Params = Promise<{ id: string }>;

export default async function EditLivePage({ params }: { params: Params }) {
  await requireRole(["ADMIN", "SELLER"]);
  const { id } = await params;
  const prisma = getPrisma();
  const live = await prisma.liveSession.findUnique({
    where: { id },
    select: { id: true, status: true, name: true, channel: true, responsibleId: true, notes: true },
  });
  if (!live) notFound();
  if (live.status !== "OPEN") redirect(`/lives/${id}`);

  const responsibles = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "SELLER"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar live</h1>
        <p className="text-sm text-muted-foreground">
          Solo puedes editar un live mientras esté abierto.
        </p>
      </div>
      <LiveForm
        mode="edit"
        action={updateLiveAction.bind(null, id)}
        cancelHref={`/lives/${id}`}
        responsibles={responsibles}
        initial={{
          name: live.name,
          channel: live.channel,
          responsibleId: live.responsibleId,
          notes: live.notes,
        }}
      />
    </div>
  );
}
