import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Route } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  value: string;
  hint?: string;
  href?: Route;
  tone?: "default" | "warning" | "success" | "destructive";
};

const TONE_CLASS: Record<NonNullable<Props["tone"]>, string> = {
  default: "",
  warning: "text-amber-600",
  success: "text-emerald-600",
  destructive: "text-destructive",
};

export function DashboardMetricCard({ title, value, hint, href, tone = "default" }: Props) {
  const content = (
    <Card
      className={cn(
        "h-full transition-colors",
        href && "hover:bg-muted/40",
      )}
    >
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={cn("text-2xl", TONE_CLASS[tone])}>
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
      ) : null}
      {href ? (
        <CardContent className="mt-auto flex items-center justify-end pt-0 text-xs text-muted-foreground">
          <ArrowRight className="size-3" />
        </CardContent>
      ) : null}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}
