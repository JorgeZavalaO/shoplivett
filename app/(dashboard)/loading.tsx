import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card className="border-border">
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="h-5 w-44 animate-pulse rounded-md bg-muted" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="h-3 w-20 animate-pulse rounded-md bg-muted" />
                  <div className="mt-3 h-6 w-28 animate-pulse rounded-md bg-muted" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          {[0, 1].map((i) => (
            <Card key={i} className="border-border">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
                <div className="h-24 animate-pulse rounded-md bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded-md bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
