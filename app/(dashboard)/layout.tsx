import { requireUser } from "@/lib/permissions";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
