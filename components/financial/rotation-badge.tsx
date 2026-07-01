import { Badge } from "@/components/ui/badge";
import {
  classifyRotation,
  rotationLabel,
  type RotationLevel,
} from "@/lib/financial-ui";

const CLASSNAME: Record<RotationLevel, string> = {
  fresh: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
  aging: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200",
  stale: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200",
  never: "bg-destructive/10 text-destructive border-destructive/20",
};

export function RotationBadge({
  daysSinceLastSale,
  thresholdDays,
}: {
  daysSinceLastSale: number | null;
  thresholdDays: number;
}) {
  const level = classifyRotation(daysSinceLastSale, thresholdDays);
  return (
    <Badge variant="outline" className={CLASSNAME[level]}>
      {rotationLabel(level)}
      {daysSinceLastSale === null ? "" : ` · ${daysSinceLastSale}d`}
    </Badge>
  );
}
