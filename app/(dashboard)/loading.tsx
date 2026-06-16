import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="border-border">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
              <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
            <div className="h-32 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
            <div className="h-32 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
