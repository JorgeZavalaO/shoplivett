"use client";

import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  sprint: string;
  bullets: string[];
};

export function ModulePlaceholder({
  title,
  description,
  sprint,
  bullets,
}: ModulePlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <Badge variant="secondary">{sprint}</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendiente para este sprint</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
