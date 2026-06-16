import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type SummaryCardProps = {
  title: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive";
};

const toneClass: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-emerald-600",
  warning: "text-amber-600",
  destructive: "text-destructive",
};

export function SummaryCard({
  title,
  value,
  hint,
  tone = "default",
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className={`text-2xl ${toneClass[tone]}`}>{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {hint}
        </CardContent>
      ) : null}
    </Card>
  );
}
